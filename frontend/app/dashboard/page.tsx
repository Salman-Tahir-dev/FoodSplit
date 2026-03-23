'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import BottomNav from '../../components/layout/BottomNav';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      api.getDashboard().then(setData).catch(console.error);
    }
  }, [user]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF7043]" /></div>;

  const balanceColor = user.balance < -500 ? 'text-red-600' : user.balance < 0 ? 'text-orange-500' : 'text-green-600';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#FF7043] text-white px-4 pt-12 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[#FFCCBC] text-sm">Welcome back,</p>
            <h1 className="text-xl font-bold">{user.name}</h1>
            {user.is_admin && (
              <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                ⚡ Global Admin
              </span>
            )}
          </div>
          <button onClick={logout} className="text-[#FFCCBC] hover:text-white text-sm">Logout</button>
        </div>

        {/* Balance Card */}
        <div className="mt-6 bg-white/10 rounded-2xl p-4">
          <p className="text-[#FFCCBC] text-sm">Your Balance</p>
          <p className={`text-3xl font-bold mt-1 ${user.balance < 0 ? 'text-red-300' : 'text-white'}`}>
            {user.balance >= 0 ? '+' : ''}{user.balance?.toFixed(2)} PKR
          </p>
          {user.balance < -500 && (
            <p className="text-red-300 text-xs mt-2">⚠️ Balance below -500 PKR. Please clear payment.</p>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/expenses/new" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <span className="text-2xl">➕</span>
            <div>
              <p className="font-medium text-gray-800 text-sm">Add Expense</p>
              <p className="text-xs text-gray-500">Split with group</p>
            </div>
          </Link>
          <Link href="/payments/new" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="font-medium text-gray-800 text-sm">Pay Dues</p>
              <p className="text-xs text-gray-500">Submit payment</p>
            </div>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-[#FF7043]">{data?.groups?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Groups</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-green-600">{user.total_contributed?.toFixed(0)}</p>
            <p className="text-xs text-gray-500 mt-1">Contributed</p>
          </div>
          {user.is_admin && (
            <Link href="/admin" className="bg-yellow-50 rounded-xl p-3 text-center shadow-sm border border-yellow-100">
              <p className="text-2xl font-bold text-yellow-600">{data?.pending_payments_count || 0}</p>
              <p className="text-xs text-yellow-700 mt-1">Pending Pay</p>
            </Link>
          )}
          {!user.is_admin && (
            <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-purple-600">{data?.unread_notifications || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Unread</p>
            </div>
          )}
        </div>

        {/* My Groups */}
        {data?.groups?.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">My Groups</h2>
            <div className="space-y-2">
              {data.groups.map((g: any) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#FFF3E0] rounded-full w-9 h-9 flex items-center justify-center text-[#FF7043] font-bold">
                      {g.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{g.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{g.role}</p>
                    </div>
                  </div>
                  <span className="text-gray-400">›</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Expenses */}
        {data?.recent_expenses?.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Recent Expenses</h2>
            <div className="space-y-2">
              {data.recent_expenses.map((e: any) => (
                <div key={e.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.groups?.name} · {e.users?.name}</p>
                  </div>
                  <p className="font-semibold text-red-600 text-sm">-{e.per_person_amount} PKR</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}