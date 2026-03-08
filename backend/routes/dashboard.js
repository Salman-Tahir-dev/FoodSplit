const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's groups
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, role, groups(id, name)')
      .eq('user_id', userId);

    const groupIds = memberships?.map(m => m.group_id) || [];

    // Get recent expenses
    let recentExpenses = [];
    if (groupIds.length > 0) {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*, users!expenses_created_by_fkey(name), groups(name)')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(5);
      recentExpenses = expenses || [];
    }

    // Get pending payments count (admin only)
    let pendingPaymentsCount = 0;
    if (req.user.is_admin) {
      const { count } = await supabase
        .from('payments')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');
      pendingPaymentsCount = count || 0;
    }

    // Get unread notifications count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);

    res.json({
      user: req.user,
      groups: memberships?.map(m => ({ ...m.groups, role: m.role })) || [],
      recent_expenses: recentExpenses,
      pending_payments_count: pendingPaymentsCount,
      unread_notifications: unreadCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
