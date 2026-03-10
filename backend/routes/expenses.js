const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

// Sanitize errors - never show technical messages to users
function userError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const msg = error.message || error.toString();
  // Hide technical/database errors
  const technical = [
    'duplicate key', 'violates', 'constraint', 'syntax error',
    'relation', 'column', 'PGRST', 'JWT', 'supabase', 'postgres',
    'undefined', 'null value', 'foreign key', 'uuid', 'index',
    'ERROR:', 'failed to', 'ECONNREFUSED', 'socket'
  ];
  if (technical.some(t => msg.toLowerCase().includes(t.toLowerCase()))) {
    return fallback;
  }
  return msg;
}


// GET /api/expenses
router.get('/', authenticate, async (req, res) => {
  const { group_id, limit = 20, offset = 0 } = req.query;
  try {
    let query = supabase
      .from('expenses')
      .select(`*, groups ( id, name ), users!expenses_created_by_fkey ( id, name ), expense_participants ( user_id, amount_owed, is_paid, users(id, name) )`)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (group_id) {
      const { data: membership } = await supabase
        .from('group_members').select('role')
        .eq('group_id', group_id).eq('user_id', req.user.id).single();
      if (!membership) return res.status(403).json({ error: 'Not a member of this group' });
      query = query.eq('group_id', group_id);
    } else {
      const { data: memberships } = await supabase
        .from('group_members').select('group_id').eq('user_id', req.user.id);
      const groupIds = memberships?.map(m => m.group_id) || [];
      if (groupIds.length === 0) return res.json({ expenses: [] });
      query = query.in('group_id', groupIds);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: userError(error) });
    res.json({ expenses: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /api/expenses — GROUP ADMIN ONLY
// Body: { group_id, title, description, total_amount, participant_ids: string[] }
// participant_ids = array of user IDs who actually ate/participated (admin chooses)
router.post('/', authenticate, async (req, res) => {
  const { group_id, title, description, total_amount, participant_ids, expense_date } = req.body;

  if (!group_id || !title || !total_amount)
    return res.status(400).json({ error: 'group_id, title, and total_amount required' });

  if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0)
    return res.status(400).json({ error: 'Select at least one participant' });

  try {
    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', group_id).eq('user_id', req.user.id).single();

    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });
    if (membership.role !== 'admin' && !req.user.is_admin)
      return res.status(403).json({ error: 'Only the group admin can add expenses' });

    const participantCount = participant_ids.length;
    const perPersonAmount = parseFloat(total_amount) / participantCount;

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        group_id, created_by: req.user.id, title, description,
        total_amount: parseFloat(total_amount),
        per_person_amount: perPersonAmount,
        participant_count: participantCount,
        expense_date: expense_date || new Date().toISOString()
      })
      .select().single();

    if (error) return res.status(500).json({ error: userError(error) });

    // Only insert participants who actually ate
    const participantInserts = participant_ids.map(uid => ({
      expense_id: expense.id, user_id: uid, amount_owed: perPersonAmount
    }));
    await supabase.from('expense_participants').insert(participantInserts);

    // Note: balance is automatically deducted by Supabase trigger (update_balance_after_expense)
    // when expense_participants rows are inserted above - no manual update needed

    // Notify participants (except admin who created)
    const notifInserts = participant_ids
      .filter(uid => uid !== req.user.id)
      .map(uid => ({
        user_id: uid,
        title: 'New Expense Added',
        message: `Admin added expense "${title}" — your share is ${perPersonAmount.toFixed(2)} PKR`,
        type: 'info', related_id: expense.id, related_type: 'expense'
      }));
    if (notifInserts.length > 0) await supabase.from('notifications').insert(notifInserts);

    res.status(201).json({ expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// GET /api/expenses/:id
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: expense, error } = await supabase
      .from('expenses')
      .select(`*, groups ( id, name ), users!expenses_created_by_fkey ( id, name ), expense_participants ( user_id, amount_owed, is_paid, users ( id, name, avatar_url ) )`)
      .eq('id', id).single();

    if (error || !expense) return res.status(404).json({ error: 'Expense not found' });
    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', expense.group_id).eq('user_id', req.user.id).single();
    if (!membership) return res.status(403).json({ error: 'Access denied' });
    res.json({ expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// DELETE /api/expenses/:id — admin only
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: expense } = await supabase
      .from('expenses').select('created_by, group_id').eq('id', id).single();
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const { data: membership } = await supabase
      .from('group_members').select('role')
      .eq('group_id', expense.group_id).eq('user_id', req.user.id).single();
    if (membership?.role !== 'admin' && !req.user.is_admin)
      return res.status(403).json({ error: 'Only group admin can delete expenses' });
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return res.status(500).json({ error: userError(error) });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;