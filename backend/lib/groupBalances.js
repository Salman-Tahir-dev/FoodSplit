function roundBalance(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function getGroupBalanceDetails(supabase, groupId) {
  const [membersResult, expensesResult, duesUpdatesResult, paymentsResult] = await Promise.all([
    supabase
      .from('group_members')
      .select('user_id, role, joined_at, users ( id, name, email, avatar_url )')
      .eq('group_id', groupId),
    supabase
      .from('expenses')
      .select('expense_participants ( user_id, amount_owed )')
      .eq('group_id', groupId),
    supabase
      .from('dues_updates')
      .select('user_id, balance_adjustment')
      .eq('group_id', groupId),
    supabase
      .from('payments')
      .select('user_id, amount, created_at')
      .eq('group_id', groupId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),
  ]);

  const { data: members, error: membersError } = membersResult;
  const { data: expenses, error: expensesError } = expensesResult;
  const { data: duesUpdates, error: duesUpdatesError } = duesUpdatesResult;
  const { data: payments, error: paymentsError } = paymentsResult;

  if (membersError) throw membersError;
  if (expensesError) throw expensesError;
  if (duesUpdatesError) throw duesUpdatesError;
  if (paymentsError) throw paymentsError;

  const owedByUser = new Map();
  const creditByUser = new Map();
  const latestPaymentByUser = new Map();

  for (const expense of expenses || []) {
    for (const participant of expense.expense_participants || []) {
      const userId = participant.user_id;
      const amountOwed = Number(participant.amount_owed) || 0;
      owedByUser.set(userId, (owedByUser.get(userId) || 0) + amountOwed);
    }
  }

  for (const update of duesUpdates || []) {
    const userId = update.user_id;
    const adjustment = Number(update.balance_adjustment) || 0;
    creditByUser.set(userId, (creditByUser.get(userId) || 0) + adjustment);
  }

  for (const payment of payments || []) {
    if (!latestPaymentByUser.has(payment.user_id)) {
      latestPaymentByUser.set(payment.user_id, {
        amount: Number(payment.amount) || 0,
        created_at: payment.created_at,
      });
    }
  }

  return (members || []).map((member) => {
    const userId = member.users.id;
    const balance = roundBalance((creditByUser.get(userId) || 0) - (owedByUser.get(userId) || 0));

    return {
      ...member.users,
      role: member.role,
      joined_at: member.joined_at,
      balance,
      last_payment: latestPaymentByUser.get(userId) || null,
    };
  });
}

async function getGroupBalanceForMember(supabase, groupId, userId) {
  const members = await getGroupBalanceDetails(supabase, groupId);
  const member = members.find((item) => item.id === userId);
  return member ? member.balance : null;
}

module.exports = {
  getGroupBalanceDetails,
  getGroupBalanceForMember,
};