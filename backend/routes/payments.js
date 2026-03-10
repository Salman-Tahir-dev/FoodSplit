const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');

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


// POST /api/payments/storage-url — get signed upload URL
router.post('/storage-url', authenticate, async (req, res) => {
  const { fileName, fileType } = req.body;
  if (!fileName || !fileType)
    return res.status(400).json({ error: 'fileName and fileType required' });
  try {
    const ext = fileName.split('.').pop();
    const path = `receipts/${req.user.id}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('payments').createSignedUploadUrl(path);
    if (error) return res.status(500).json({ error: 'Failed to generate upload URL: ' + error.message });
    res.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: path,
      fullPath: path
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// GET /api/payments/receipt-url/:id — get a fresh signed READ url for a receipt
router.get('/receipt-url/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: payment } = await supabase
      .from('payments').select('receipt_url, user_id, group_id').eq('id', id).single();

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // Only the owner, group admin, or global admin can view
    if (payment.user_id !== req.user.id && !req.user.is_admin) {
      // Check if user is group admin
      if (payment.group_id) {
        const { data: membership } = await supabase
          .from('group_members').select('role')
          .eq('group_id', payment.group_id).eq('user_id', req.user.id).single();
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (!payment.receipt_url) return res.status(404).json({ error: 'No receipt uploaded' });

    // Generate a fresh signed URL valid for 60 minutes
    const { data, error } = await supabase.storage
      .from('payments')
      .createSignedUrl(payment.receipt_url, 3600);

    if (error) return res.status(500).json({ error: 'Failed to generate receipt URL: ' + error.message });
    res.json({ url: data.signedUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get receipt URL' });
  }
});

// GET /api/payments/pending — global admin OR group admin
router.get('/pending', authenticate, async (req, res) => {
  try {
    let payments = [];

    if (req.user.is_admin) {
      // Global admin sees all pending
      const { data, error } = await supabase
        .from('payments')
        .select(`*, users!payments_user_id_fkey ( id, name, email, avatar_url ), groups ( id, name )`)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: userError(error) });
      payments = data;
    } else {
      // Group admin sees pending payments for their groups
      const { data: adminGroups } = await supabase
        .from('group_members').select('group_id')
        .eq('user_id', req.user.id).eq('role', 'admin');

      if (adminGroups && adminGroups.length > 0) {
        const groupIds = adminGroups.map(g => g.group_id);
        const { data, error } = await supabase
          .from('payments')
          .select(`*, users!payments_user_id_fkey ( id, name, email, avatar_url ), groups ( id, name )`)
          .eq('status', 'pending')
          .in('group_id', groupIds)
          .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: userError(error) });
        payments = data;
      }
    }

    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// PATCH /api/payments/approve/:id — global admin OR group admin can approve
router.patch('/approve/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body;

  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approved or rejected' });
  }

  try {
    const { data: payment, error: fetchError } = await supabase
      .from('payments').select('*').eq('id', id).single();

    if (fetchError || !payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ error: 'Payment already processed' });

    // Check permission: global admin OR group admin
    if (!req.user.is_admin) {
      if (payment.group_id) {
        const { data: membership } = await supabase
          .from('group_members').select('role')
          .eq('group_id', payment.group_id).eq('user_id', req.user.id).single();
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'Only group admin can approve payments' });
        }
      } else {
        return res.status(403).json({ error: 'Only admin can approve payments' });
      }
    }

    const { data: updated, error } = await supabase
      .from('payments')
      .update({
        status: action,
        notes: notes || payment.notes,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id).select().single();

    if (error) return res.status(500).json({ error: userError(error) });

    if (action === 'approved') {
      // Note: balance is automatically updated by Supabase trigger (update_balance_after_payment)
      // when payment status changes to 'approved' - no manual update needed here

      // Log to dues_updates for history
      if (payment.group_id) {
        const { data: userData } = await supabase
          .from('users').select('balance').eq('id', payment.user_id).single();
        if (userData) {
          await supabase.from('dues_updates').insert({
            group_id: payment.group_id,
            user_id: payment.user_id,
            updated_by: req.user.id,
            balance_before: parseFloat(userData.balance),
            balance_adjustment: parseFloat(payment.amount),
            balance_after: parseFloat(userData.balance) + parseFloat(payment.amount),
            notes: `Payment of ${payment.amount} PKR approved`
          });
        }
      }

      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: '✅ Payment Approved',
        message: `Your payment of ${payment.amount} PKR has been approved. Your balance has been updated automatically.`,
        type: 'success', related_id: payment.id, related_type: 'payment'
      });
    }

    if (action === 'rejected') {
      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: '❌ Payment Rejected',
        message: `Your payment of ${payment.amount} PKR was rejected.${notes ? ' Reason: ' + notes : ' Please contact your group admin.'}`,
        type: 'error', related_id: payment.id, related_type: 'payment'
      });
    }

    res.json({ payment: updated, message: `Payment ${action} successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// POST /api/payments/upload-receipt — member submits payment with receipt
router.post('/upload-receipt', authenticate, async (req, res) => {
  const { amount, group_id, receipt_url, notes } = req.body;
  if (!amount || parseFloat(amount) <= 0)
    return res.status(400).json({ error: 'Valid amount required' });

  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        user_id: req.user.id,
        group_id: group_id || null,
        amount: parseFloat(amount),
        receipt_url: receipt_url || null,
        notes: notes || null,
        status: 'pending'
      })
      .select().single();

    if (error) return res.status(500).json({ error: userError(error) });

    // Notify group admins
    if (group_id) {
      const { data: groupAdmins } = await supabase
        .from('group_members').select('user_id')
        .eq('group_id', group_id).eq('role', 'admin');

      if (groupAdmins && groupAdmins.length > 0) {
        const notifs = groupAdmins.map(ga => ({
          user_id: ga.user_id,
          title: '💳 New Payment Submitted',
          message: `${req.user.name} submitted a payment of ${amount} PKR. Please review and approve it in the Payments section.`,
          type: 'info', related_id: payment.id, related_type: 'payment'
        }));
        await supabase.from('notifications').insert(notifs);
      }
    }

    // Also notify global admins
    const { data: admins } = await supabase.from('users').select('id').eq('is_admin', true);
    if (admins && admins.length > 0) {
      const notifs = admins.map(a => ({
        user_id: a.id,
        title: '💳 New Payment Submitted',
        message: `${req.user.name} submitted a payment of ${amount} PKR for review.`,
        type: 'info', related_id: payment.id, related_type: 'payment'
      }));
      await supabase.from('notifications').insert(notifs);
    }

    res.status(201).json({ payment, message: 'Payment submitted. Waiting for admin approval.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit payment' });
  }
});

// GET /api/payments
router.get('/', authenticate, async (req, res) => {
  const { group_id, status, limit = 20, offset = 0 } = req.query;
  try {
    let query = supabase
      .from('payments')
      .select(`*, users!payments_user_id_fkey ( id, name, email, avatar_url ), groups ( id, name )`)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (!req.user.is_admin) query = query.eq('user_id', req.user.id);
    if (group_id) query = query.eq('group_id', group_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: userError(error) });
    res.json({ payments: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

module.exports = router;