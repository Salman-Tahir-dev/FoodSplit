const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

// Helper: check group admin
async function isGroupAdmin(userId, groupId) {
  const { data } = await supabase
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', userId).single();
  return data?.role === 'admin';
}

// POST /api/invitations/send — admin invites a user by email
router.post('/send', authenticate, async (req, res) => {
  const { group_id, email } = req.body;
  if (!group_id || !email) return res.status(400).json({ error: 'group_id and email required' });

  try {
    const adminCheck = await isGroupAdmin(req.user.id, group_id);
    if (!adminCheck && !req.user.is_admin)
      return res.status(403).json({ error: 'Only group admin can send invitations' });

    // Get group info
    const { data: group } = await supabase.from('groups').select('name').eq('id', group_id).single();
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Find the target user
    const { data: targetUser } = await supabase.from('users').select('id, name, email').eq('email', email.toLowerCase().trim()).single();
    if (!targetUser) return res.status(404).json({ error: 'No account found with that email. They need to sign up first.' });

    // Check not already a member
    const { data: existing } = await supabase.from('group_members').select('id')
      .eq('group_id', group_id).eq('user_id', targetUser.id).single();
    if (existing) return res.status(400).json({ error: `${targetUser.name} is already a member of this group` });

    // Check no pending invite already
    const { data: pendingInvite } = await supabase.from('group_invitations')
      .select('id').eq('group_id', group_id).eq('invited_user_id', targetUser.id).eq('status', 'pending').single();
    if (pendingInvite) return res.status(400).json({ error: `${targetUser.name} already has a pending invitation` });

    // Create invitation record
    const { data: invitation, error } = await supabase.from('group_invitations').insert({
      group_id,
      invited_by: req.user.id,
      invited_user_id: targetUser.id,
      status: 'pending'
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    // Send notification to the invited user
    await supabase.from('notifications').insert({
      user_id: targetUser.id,
      title: '📩 Group Invitation',
      message: `${req.user.name} invited you to join the group "${group.name}". Tap to Accept or Decline.`,
      type: 'invite',
      related_id: invitation.id,
      related_type: 'group_invitation'
    });

    res.json({ message: `Invitation sent to ${targetUser.name}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// POST /api/invitations/join-by-code — any user joins via invite code
router.post('/join-by-code', authenticate, async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'Invite code required' });

  try {
    const { data: group } = await supabase.from('groups').select('id, name')
      .eq('invite_code', invite_code.toUpperCase().trim()).single();

    if (!group) return res.status(404).json({ error: 'Invalid invite code. Please check and try again.' });

    // Check not already a member
    const { data: existing } = await supabase.from('group_members').select('id')
      .eq('group_id', group.id).eq('user_id', req.user.id).single();
    if (existing) return res.status(400).json({ error: `You are already a member of "${group.name}"` });

    // Add directly as member
    const { error } = await supabase.from('group_members').insert({
      group_id: group.id, user_id: req.user.id, role: 'member'
    });
    if (error) return res.status(500).json({ error: error.message });

    // Notify group admins
    const { data: admins } = await supabase.from('group_members').select('user_id')
      .eq('group_id', group.id).eq('role', 'admin');
    if (admins?.length) {
      await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.user_id,
        title: '👤 New Member Joined',
        message: `${req.user.name} joined "${group.name}" using the invite code.`,
        type: 'info', related_type: 'group_join'
      })));
    }

    res.json({ message: `You joined "${group.name}" successfully!`, group_id: group.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// PATCH /api/invitations/:id/respond — user accepts or rejects invitation
router.patch('/:id/respond', authenticate, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'accepted' or 'rejected'

  if (!['accepted', 'rejected'].includes(action))
    return res.status(400).json({ error: 'Action must be accepted or rejected' });

  try {
    const { data: invitation } = await supabase.from('group_invitations')
      .select('*, groups(id, name)').eq('id', id).single();

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.invited_user_id !== req.user.id)
      return res.status(403).json({ error: 'This invitation is not for you' });
    if (invitation.status !== 'pending')
      return res.status(400).json({ error: 'Invitation already responded to' });

    // Update invitation status
    await supabase.from('group_invitations').update({ status: action }).eq('id', id);

    if (action === 'accepted') {
      // Check not already a member (race condition guard)
      const { data: existing } = await supabase.from('group_members').select('id')
        .eq('group_id', invitation.group_id).eq('user_id', req.user.id).single();

      if (!existing) {
        await supabase.from('group_members').insert({
          group_id: invitation.group_id, user_id: req.user.id, role: 'member'
        });
      }

      // Notify the admin who invited
      await supabase.from('notifications').insert({
        user_id: invitation.invited_by,
        title: '✅ Invitation Accepted',
        message: `${req.user.name} accepted your invitation and joined "${invitation.groups.name}".`,
        type: 'success', related_type: 'group_join'
      });

      return res.json({ message: `You joined "${invitation.groups.name}"!`, group_id: invitation.group_id });
    }

    if (action === 'rejected') {
      await supabase.from('notifications').insert({
        user_id: invitation.invited_by,
        title: '❌ Invitation Declined',
        message: `${req.user.name} declined your invitation to join "${invitation.groups.name}".`,
        type: 'info', related_type: 'group_invite_declined'
      });
      return res.json({ message: 'Invitation declined' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond to invitation' });
  }
});

// GET /api/invitations/pending — get user's pending invitations
router.get('/pending', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from('group_invitations')
      .select('*, groups(id, name, description), inviter:users!group_invitations_invited_by_fkey(id, name)')
      .eq('invited_user_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ invitations: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

module.exports = router;