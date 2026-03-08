const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [
      { count: userCount },
      { count: groupCount },
      { count: expenseCount },
      { count: pendingCount },
      { data: recentPayments },
      { data: recentUsers }
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact' }),
      supabase.from('groups').select('id', { count: 'exact' }),
      supabase.from('expenses').select('id', { count: 'exact' }),
      supabase.from('payments').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('payments')
        .select('*, users!payments_user_id_fkey(name, email), groups(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10),
      supabase.from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    res.json({
      stats: {
        total_users: userCount,
        total_groups: groupCount,
        total_expenses: expenseCount,
        pending_payments: pendingCount
      },
      recent_payments: recentPayments || [],
      recent_users: recentUsers || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin dashboard' });
  }
});

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id — update user (toggle admin, update balance, etc.)
router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { is_admin, balance, name } = req.body;

  try {
    const updates = {};
    if (typeof is_admin === 'boolean') updates.is_admin = is_admin;
    if (typeof balance !== 'undefined') updates.balance = parseFloat(balance);
    if (name) updates.name = name;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  // Prevent self-deletion
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// DELETE /api/admin/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// DELETE /api/admin/groups/:id
router.delete('/groups/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// POST /api/admin/groups/:id/remove-member
router.post('/groups/:groupId/remove-member', async (req, res) => {
  const { groupId } = req.params;
  const { user_id } = req.body;

  try {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user_id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// GET /api/admin/payments — all payments
router.get('/payments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, users!payments_user_id_fkey(name, email), groups(name)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ payments: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

module.exports = router;
