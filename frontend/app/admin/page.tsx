'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import BottomNav from '../../components/layout/BottomNav';

type Tab = 'overview' | 'users' | 'payments';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/login');
      else if (!user.is_admin) router.push('/dashboard');
    }
  }, [user, loading]);

  const loadData = async () => {
    try {
      const [dashData, usersData, paymentsData, pendingData] = await Promise.all([
        api.getAdminDashboard() as any,
        api.getAdminUsers() as any,
        api.getAdminPayments() as any,
        api.getPendingPayments() as any,
      ]);
      setStats(dashData.stats);
      setUsers(usersData.users);
      setPayments(paymentsData.payments);
      setPendingPayments(pendingData.payments);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user?.is_admin) loadData();
  }, [user]);

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`${currentStatus ? 'Remove' : 'Grant'} admin access?`)) return;
    setActionLoading(userId);
    try {
      await api.updateAdminUser(userId, { is_admin: !currentStatus });
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprovePayment = async (id: string, action: 'approved' | 'rejected') => {
    setActionLoading(id + action);
    try {
      await api.approvePayment(id, action);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || fetching) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-indigo-800 text-white px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold">⚡ Admin Panel</h1>
        <p className="text-indigo-300 text-sm mt-1">Manage users, payments & groups</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex">
        {(['overview', 'users', 'payments'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
          >
            {t}
            {t === 'payments' && pendingPayments.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{pendingPayments.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* OVERVIEW */}
        {tab === 'overview' && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Users', value: stats.total_users, color: 'text-indigo-600' },
                { label: 'Total Groups', value: stats.total_groups, color: 'text-green-600' },
                { label: 'Total Expenses', value: stats.total_expenses, color: 'text-purple-600' },
                { label: 'Pending Payments', value: stats.pending_payments, color: 'text-orange-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {pendingPayments.length > 0 && (
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                <p className="font-semibold text-orange-800 mb-3">Payments Awaiting Review ({pendingPayments.length})</p>
                <div className="space-y-3">
                  {pendingPayments.slice(0, 3).map(p => (
                    <div key={p.id} className="bg-white rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <p className="font-medium text-sm">{p.users?.name}</p>
                          <p className="text-xs text-gray-500">{p.amount} PKR{p.groups ? ` · ${p.groups.name}` : ''}</p>
                        </div>
                        {p.receipt_url && (
                          <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600">View Receipt</a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprovePayment(p.id, 'approved')}
                          disabled={!!actionLoading}
                          className="flex-1 bg-green-600 text-white rounded-lg py-1.5 text-xs disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleApprovePayment(p.id, 'rejected')}
                          disabled={!!actionLoading}
                          className="flex-1 bg-red-500 text-white rounded-lg py-1.5 text-xs disabled:opacity-50"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingPayments.length > 3 && (
                    <button onClick={() => setTab('payments')} className="w-full text-sm text-indigo-600 text-center py-2">
                      View all {pendingPayments.length} pending →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 text-sm">{u.name} {u.id === user?.id && '(You)'}</p>
                      {u.is_admin && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Global Admin</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                    <p className={`text-xs font-semibold mt-1 ${u.balance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      Balance: {u.balance >= 0 ? '+' : ''}{parseFloat(u.balance || 0).toFixed(2)} PKR
                    </p>
                  </div>
                  {u.id !== user?.id && (
                    <button
                      onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                      disabled={actionLoading === u.id}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 ${u.is_admin ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}
                    >
                      {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <div className="space-y-3">
            {pendingPayments.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2 text-sm">Pending Review ({pendingPayments.length})</h3>
                {pendingPayments.map(p => (
                  <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-yellow-100 mb-3">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800">{p.amount} PKR</p>
                        <p className="text-sm text-gray-600">{p.users?.name}</p>
                        <p className="text-xs text-gray-400">{p.users?.email}</p>
                        {p.groups && <p className="text-xs text-indigo-500 mt-0.5">Group: {p.groups.name}</p>}
                        {p.notes && <p className="text-xs text-gray-500 italic mt-1">"{p.notes}"</p>}
                      </div>
                      {p.receipt_url && (
                        <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 border border-indigo-100 rounded-lg px-2 py-1">
                          Receipt
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovePayment(p.id, 'approved')}
                        disabled={!!actionLoading}
                        className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
                      >
                        {actionLoading === p.id + 'approved' ? '...' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => handleApprovePayment(p.id, 'rejected')}
                        disabled={!!actionLoading}
                        className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm disabled:opacity-50"
                      >
                        {actionLoading === p.id + 'rejected' ? '...' : '✗ Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="font-semibold text-gray-700 mb-2 text-sm">All Payments</h3>
            {payments.filter(p => p.status !== 'pending').map(p => (
              <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{p.users?.name} — {p.amount} PKR</p>
                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${p.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
