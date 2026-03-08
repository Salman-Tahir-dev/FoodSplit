const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

async function isGroupAdmin(userId, groupId) {
  const { data } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();
  return data && data.role === 'admin';
}

// ── FIXED ROUTE ORDER: all static/named routes BEFORE /:id ──────────────────

// GET /api/groups
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`role, joined_at, groups ( id, name, description, invite_code, created_by, created_at )`)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });

    const groups = data.map(gm => ({
      ...gm.groups,
      my_role: gm.role,
      joined_at: gm.joined_at,
    }));

    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// POST /api/groups
router.post('/', authenticate, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });

  try {
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name, description, created_by: req.user.id })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: req.user.id,
      role: 'admin'
    });

    res.status(201).json({ group });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// POST /api/groups/join  ← MUST be before /:id
router.post('/join', authenticate, async (req, res) => {
  const { user_email, user_id, group_id, invite_code } = req.body;

  if (group_id) {
    const adminCheck = await isGroupAdmin(req.user.id, group_id);
    if (!adminCheck && !req.user.is_admin) {
      return res.status(403).json({ error: 'Only the admin of this group can add members' });
    }

    let targetUser = null;
    if (user_id) {
      const { data } = await supabase.from('users').select('id, name, email').eq('id', user_id).single();
      targetUser = data;
    } else if (user_email) {
      const { data } = await supabase.from('users').select('id, name, email').eq('email', user_email).single();
      targetUser = data;
    }

    if (!targetUser) return res.status(404).json({ error: 'User not found. Make sure they have a FoodSplit account.' });

    const { data: existing } = await supabase
      .from('group_members').select('id')
      .eq('group_id', group_id).eq('user_id', targetUser.id).single();

    if (existing) return res.status(400).json({ error: 'User is already a member of this group' });

    const { error } = await supabase.from('group_members').insert({
      group_id, user_id: targetUser.id, role: 'member'
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: `${targetUser.name} added to group successfully` });
  }

  if (invite_code) {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only admins can add members via invite code' });
    }
    const { data: group, error } = await supabase
      .from('groups').select('id, name')
      .eq('invite_code', invite_code.toUpperCase()).single();

    if (error || !group) return res.status(404).json({ error: 'Invalid invite code' });

    await supabase.from('group_members').insert({
      group_id: group.id, user_id: req.user.id, role: 'member'
    });
    return res.json({ message: `Joined ${group.name}` });
  }

  return res.status(400).json({ error: 'Provide group_id with user_email, or invite_code' });
});

// GET /api/groups/:id  ← dynamic routes AFTER named ones
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', id).eq('user_id', req.user.id).single();

    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

    const { data: group, error } = await supabase
      .from('groups').select('*').eq('id', id).single();

    if (error || !group) return res.status(404).json({ error: 'Group not found' });

    const { data: members } = await supabase
      .from('group_members')
      .select(`role, joined_at, users ( id, name, email, balance, avatar_url )`)
      .eq('group_id', id);

    res.json({
      group: {
        ...group,
        my_role: membership.role,
        members: members.map(m => ({ ...m.users, role: m.role, joined_at: m.joined_at }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// DELETE /api/groups/:id/leave — member leaves (only if balance >= 0)
router.delete('/:id/leave', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    // Check membership exists
    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', id).eq('user_id', req.user.id).single();
    if (!membership) return res.status(404).json({ error: 'You are not a member of this group' });

    // Admin cannot leave — must transfer admin role first
    if (membership.role === 'admin') {
      return res.status(400).json({ error: 'Group admin cannot leave. Transfer admin role to another member first.' });
    }

    // Check user balance — must be >= 0 (no outstanding dues)
    const { data: userData } = await supabase
      .from('users').select('balance').eq('id', req.user.id).single();
    if (userData && parseFloat(userData.balance) < 0) {
      return res.status(400).json({ error: `You have outstanding dues of ${Math.abs(parseFloat(userData.balance)).toFixed(2)} PKR. Please clear your dues before leaving.` });
    }

    const { error } = await supabase
      .from('group_members').delete()
      .eq('group_id', id).eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'You have left the group successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// GET /api/groups/:id/dues
router.get('/:id/dues', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', id).eq('user_id', req.user.id).single();

    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

    const { data: members, error } = await supabase
      .from('group_members')
      .select(`role, joined_at, users ( id, name, email, balance, avatar_url )`)
      .eq('group_id', id);

    if (error) return res.status(500).json({ error: error.message });

    const memberDues = await Promise.all(members.map(async (m) => {
      const { data: latestPayment } = await supabase
        .from('payments').select('amount, status, created_at')
        .eq('user_id', m.users.id).eq('group_id', id).eq('status', 'approved')
        .order('created_at', { ascending: false }).limit(1).single();

      return { ...m.users, role: m.role, joined_at: m.joined_at, last_payment: latestPayment || null };
    }));

    res.json({ dues: memberDues });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dues' });
  }
});

// GET /api/groups/:id/dues-history
router.get('/:id/dues-history', authenticate, async (req, res) => {
  const { id: groupId } = req.params;
  try {
    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', req.user.id).single();

    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

    const { data, error } = await supabase
      .from('dues_updates')
      .select(`*, users!dues_updates_user_id_fkey ( id, name, email ), updater:users!dues_updates_updated_by_fkey ( id, name )`)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ dues_history: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dues history' });
  }
});

// PATCH /api/groups/:id/members/:userId/dues
router.patch('/:id/members/:userId/dues', authenticate, async (req, res) => {
  const { id: groupId, userId } = req.params;
  const { balance_adjustment, notes } = req.body;

  try {
    const adminCheck = await isGroupAdmin(req.user.id, groupId);
    if (!adminCheck && !req.user.is_admin) {
      return res.status(403).json({ error: 'Only group admins can update member dues' });
    }

    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', userId).single();

    if (!membership) return res.status(404).json({ error: 'User is not a member of this group' });

    const { data: user, error: userError } = await supabase
      .from('users').select('balance').eq('id', userId).single();

    if (userError) return res.status(500).json({ error: 'User not found' });

    const balanceBefore = parseFloat(user.balance);
    const newBalance = balanceBefore + parseFloat(balance_adjustment);

    const { error: updateError } = await supabase
      .from('users').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', userId);

    if (updateError) return res.status(500).json({ error: updateError.message });

    await supabase.from('dues_updates').insert({
      group_id: groupId, user_id: userId, updated_by: req.user.id,
      balance_before: balanceBefore, balance_adjustment: parseFloat(balance_adjustment),
      balance_after: newBalance, notes: notes || null
    });

    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Dues Updated',
      message: `Your dues have been updated. Adjustment: ${parseFloat(balance_adjustment) >= 0 ? '+' : ''}${balance_adjustment} PKR. New balance: ${newBalance} PKR.${notes ? ' Note: ' + notes : ''}`,
      type: parseFloat(balance_adjustment) >= 0 ? 'success' : 'warning',
      related_type: 'dues_update'
    });

    res.json({ message: 'Dues updated successfully', new_balance: newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update dues' });
  }
});

// PATCH /api/groups/:id/members/:userId/role
router.patch('/:id/members/:userId/role', authenticate, async (req, res) => {
  const { id: groupId, userId } = req.params;
  const { role } = req.body;

  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }

  try {
    const adminCheck = await isGroupAdmin(req.user.id, groupId);
    if (!adminCheck && !req.user.is_admin) {
      return res.status(403).json({ error: 'Only group admins can change roles' });
    }

    const { error } = await supabase
      .from('group_members').update({ role })
      .eq('group_id', groupId).eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;

// DELETE /api/groups/:id/members/:userId — group admin removes a member
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  const { id: groupId, userId } = req.params;
  try {
    const adminCheck = await isGroupAdmin(req.user.id, groupId);
    if (!adminCheck && !req.user.is_admin) {
      return res.status(403).json({ error: 'Only the group admin can remove members' });
    }
    // Cannot remove yourself via this endpoint
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Use the leave endpoint to remove yourself' });
    }
    const { error } = await supabase
      .from('group_members').delete()
      .eq('group_id', groupId).eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});