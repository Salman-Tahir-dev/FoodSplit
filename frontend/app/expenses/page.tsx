'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import BottomNav from '../../components/layout/BottomNav';

export default function ExpensesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      api.getExpenses()
        .then(d => setExpenses((d as any).expenses))
        .catch(console.error)
        .finally(() => setFetching(false));
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
        <Link href="/expenses/new" className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          + Add
        </Link>
      </div>

      <div className="px-4 py-4">
        {fetching ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-gray-500">No expenses yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map(e => (
              <div key={e.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{e.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{e.groups?.name} · {e.users?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(e.expense_date || e.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{e.total_amount} PKR</p>
                    <p className="text-xs text-red-500">Your share: -{e.per_person_amount} PKR</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
