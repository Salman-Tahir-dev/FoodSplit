'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import BottomNav from '../../components/layout/BottomNav';

export default function SettingsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-2xl mx-auto">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <p className="font-bold text-gray-800 mt-3">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
          {user.is_admin && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full mt-2 inline-block">⚡ Global Admin</span>}
          <div className="mt-3">
            <p className={`text-lg font-bold ${user.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {user.balance >= 0 ? '+' : ''}{parseFloat(user.balance?.toString() || '0').toFixed(2)} PKR
            </p>
            <p className="text-xs text-gray-400">Current Balance</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full bg-red-50 text-red-600 rounded-xl py-3 font-medium border border-red-100 hover:bg-red-100 transition-colors"
        >
          Logout
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
