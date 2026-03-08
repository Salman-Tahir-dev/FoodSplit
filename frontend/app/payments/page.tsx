'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import BottomNav from '../../components/layout/BottomNav';

const statusColor: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
const statusIcon: Record<string, string> = {
  pending:  '⏳',
  approved: '✅',
  rejected: '❌',
};

// ── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getReceiptUrl(paymentId)
      .then((d: any) => setUrl(d.url))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [paymentId]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-bold text-gray-900">📎 Payment Receipt</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
        </div>
        <div className="p-4">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm text-center">
              ❌ {error}
            </div>
          )}
          {url && (
            <>
              <img src={url} alt="Receipt" className="w-full rounded-xl object-contain max-h-96 border border-gray-100" />
              <a href={url} target="_blank" rel="noreferrer"
                className="mt-3 block text-center text-sm text-indigo-600 border border-indigo-100 rounded-xl py-2.5 hover:bg-indigo-50 font-medium">
                🔗 Open Full Size
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Approve/Reject Confirm ────────────────────────────────────────────────────
function ActionConfirm({ payment, action, onConfirm, onCancel, loading }: {
  payment: any; action: 'approved' | 'rejected';
  onConfirm: (notes: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
        <h2 className="font-bold text-gray-900 mb-1">
          {action === 'approved' ? '✅ Approve Payment' : '❌ Reject Payment'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {action === 'approved'
            ? `Approve ${payment.users?.name}'s payment of ${payment.amount} PKR? Their balance will be updated automatically.`
            : `Reject ${payment.users?.name}'s payment of ${payment.amount} PKR?`}
        </p>
        {action === 'rejected' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Invalid receipt, wrong amount..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={loading}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 ${action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {loading ? 'Processing...' : action === 'approved' ? '✅ Yes, Approve' : '❌ Yes, Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'mine' | 'pending'>('mine');
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ payment: any; action: 'approved' | 'rejected' } | null>(null);

  // Group admin check — user is admin in at least one group
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  const loadPayments = async () => {
    try {
      const d = await api.getPayments() as any;
      setPayments(d.payments);

      // Try to fetch pending — works for global admin AND group admins
      try {
        const pd = await api.getPendingPayments() as any;
        setPendingPayments(pd.payments);
        if (pd.payments.length >= 0) setIsGroupAdmin(true); // endpoint succeeded = has admin rights
      } catch {
        setIsGroupAdmin(false);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user) loadPayments();
  }, [user]);

  const handleAction = async (notes: string) => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      await api.approvePayment(confirmAction.payment.id, confirmAction.action, notes);
      setConfirmAction(null);
      await loadPayments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const canManagePayments = user?.is_admin || isGroupAdmin;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payments</h1>
          {pendingPayments.length > 0 && canManagePayments && (
            <p className="text-xs text-orange-500 mt-0.5">⚠️ {pendingPayments.length} payment{pendingPayments.length > 1 ? 's' : ''} waiting for your review</p>
          )}
        </div>
        <Link href="/payments/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          + Submit
        </Link>
      </div>

      {/* Tabs — show for admin/group admin */}
      {canManagePayments && (
        <div className="bg-white border-b border-gray-100 flex">
          <button
            onClick={() => setActiveTab('mine')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${activeTab === 'mine' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
          >
            My Payments
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${activeTab === 'pending' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
          >
            Review
            {pendingPayments.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 ml-1.5">{pendingPayments.length}</span>
            )}
          </button>
        </div>
      )}

      <div className="px-4 py-4">
        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            {/* MY PAYMENTS TAB */}
            {activeTab === 'mine' && (
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">💳</div>
                    <p className="font-medium text-gray-600 mb-1">No payments yet</p>
                    <p className="text-sm text-gray-400 mb-5">Submit a payment receipt for admin approval</p>
                    <Link href="/payments/new" className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold">
                      + Submit Payment
                    </Link>
                  </div>
                ) : (
                  payments.map(p => (
                    <div key={p.id} className={`bg-white rounded-xl p-4 shadow-sm border ${p.status === 'pending' ? 'border-yellow-100' : p.status === 'approved' ? 'border-green-100' : 'border-red-100'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-800 text-lg">{p.amount} PKR</p>
                          {p.groups && <p className="text-xs text-indigo-500 mt-0.5">Group: {p.groups.name}</p>}
                          {p.notes && <p className="text-xs text-gray-500 mt-1 italic">"{p.notes}"</p>}
                          <p className="text-xs text-gray-400 mt-1">{new Date(p.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[p.status]}`}>
                          {statusIcon[p.status]} {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </div>

                      {p.status === 'pending' && (
                        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-xs text-yellow-700 mb-2">
                          ⏳ Waiting for admin approval. You will be notified once reviewed.
                        </div>
                      )}
                      {p.status === 'approved' && (
                        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-700 mb-2">
                          ✅ Approved — your balance has been updated.
                        </div>
                      )}
                      {p.status === 'rejected' && (
                        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700 mb-2">
                          ❌ Rejected{p.notes ? ` — ${p.notes}` : '. Please contact your admin.'}
                        </div>
                      )}

                      {p.receipt_url && (
                        <button
                          onClick={() => setReceiptPaymentId(p.id)}
                          className="text-xs text-indigo-600 border border-indigo-100 rounded-lg px-3 py-1.5 hover:bg-indigo-50 font-medium"
                        >
                          📎 View Receipt
                        </button>
                      )}

                      {/* Approve/reject only for admin viewing someone else's payment */}
                      {canManagePayments && p.status === 'pending' && p.user_id !== user?.id && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setConfirmAction({ payment: p, action: 'approved' })}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-semibold"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => setConfirmAction({ payment: p, action: 'rejected' })}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* PENDING REVIEW TAB (admin/group admin) */}
            {activeTab === 'pending' && canManagePayments && (
              <div className="space-y-3">
                {pendingPayments.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="font-medium text-gray-600">All caught up!</p>
                    <p className="text-sm text-gray-400 mt-1">No payments waiting for review</p>
                  </div>
                ) : (
                  pendingPayments.map(p => (
                    <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-yellow-100">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-gray-800 text-xl">{p.amount} PKR</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="bg-indigo-100 rounded-full w-6 h-6 flex items-center justify-center text-indigo-700 font-bold text-xs">
                              {p.users?.name?.[0]?.toUpperCase()}
                            </div>
                            <p className="text-sm font-medium text-gray-700">{p.users?.name}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{p.users?.email}</p>
                          {p.groups && <p className="text-xs text-indigo-500 mt-1">📌 Group: {p.groups.name}</p>}
                          {p.notes && <p className="text-xs text-gray-500 mt-1 italic">"{p.notes}"</p>}
                          <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(p.created_at).toLocaleString()}</p>
                        </div>
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-semibold">⏳ Pending</span>
                      </div>

                      {p.receipt_url && (
                        <button
                          onClick={() => setReceiptPaymentId(p.id)}
                          className="w-full text-sm text-indigo-600 border border-indigo-100 rounded-xl py-2.5 mb-3 hover:bg-indigo-50 font-medium"
                        >
                          📎 View Receipt Screenshot
                        </button>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmAction({ payment: p, action: 'approved' })}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => setConfirmAction({ payment: p, action: 'rejected' })}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Receipt Modal */}
      {receiptPaymentId && (
        <ReceiptModal paymentId={receiptPaymentId} onClose={() => setReceiptPaymentId(null)} />
      )}

      {/* Approve/Reject Confirm */}
      {confirmAction && (
        <ActionConfirm
          payment={confirmAction.payment}
          action={confirmAction.action}
          onConfirm={handleAction}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading}
        />
      )}

      <BottomNav />
    </div>
  );
}