'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import BottomNav from '../../../components/layout/BottomNav';

type Tab = 'members' | 'expenses' | 'dues';

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center">
      {/* Modal sits above BottomNav (z-[100] > BottomNav z-index) */}
      {/* On mobile: bottom margin = 64px (bottom nav height) so footer buttons are never covered */}
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 80px)', marginBottom: '64px' }}>
        {/* Fixed header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none w-8 h-8 flex items-center justify-center">&times;</button>
        </div>
        {/* Scrollable body */}
        <div className="px-5 py-5 overflow-y-auto flex-1">{children}</div>
        {/* Sticky footer — always visible above bottom nav */}
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading }: {
  title: string; message: string; confirmLabel: string;
  confirmClass: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
        <h2 className="font-bold text-gray-900 text-base mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${confirmClass}`}>
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GroupDetailPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dues, setDues] = useState<any[]>([]);
  const [duesHistory, setDuesHistory] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('members');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const [showAddMember, setShowAddMember] = useState(false);
  const [showUpdateDues, setShowUpdateDues] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);

  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');
  const [addMemberSuccess, setAddMemberSuccess] = useState('');

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [adjustment, setAdjustment] = useState('');
  const [duesNotes, setDuesNotes] = useState('');
  const [updatingDues, setUpdatingDues] = useState(false);
  const [duesError, setDuesError] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  const loadGroup = async () => {
    try {
      const [gData, eData, dData, dhData] = await Promise.all([
        api.getGroup(id) as any,
        api.getExpenses(id) as any,
        api.getGroupDues(id) as any,
        api.getGroupDuesHistory(id) as any,
      ]);
      setGroup(gData.group);
      setExpenses(eData.expenses);
      setDues(dData.dues);
      setDuesHistory(dhData.dues_history);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && id) loadGroup();
  }, [user, id]);

  const isGroupAdmin = group?.my_role === 'admin' || user?.is_admin;
  const myDues = dues.find(m => m.id === user?.id);
  const myBalance = myDues ? parseFloat(myDues.balance ?? 0) : null;
  // Can leave if dues are loaded AND balance is >= 0 (zero means all clear, positive means overpaid/credited)
  const canLeave = myBalance !== null && myBalance >= 0;
  const duesLoaded = myBalance !== null;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    setAddMemberError('');
    setAddMemberSuccess('');
    try {
      const res = await api.sendInvitation(id, memberEmail) as any;
      setAddMemberSuccess(`✅ Invitation sent! ${memberEmail} will see an Accept/Decline option in their Alerts.`);
      setMemberEmail('');
    } catch (err: any) {
      setAddMemberError(err.message || 'Could not send invitation. Make sure the email is registered.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateDues = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedMember || !adjustment) return;
    setUpdatingDues(true);
    setDuesError('');
    try {
      await api.updateMemberDues(id, selectedMember.id, parseFloat(adjustment), duesNotes);
      setShowUpdateDues(false);
      setAdjustment('');
      setDuesNotes('');
      setSelectedMember(null);
      await Promise.all([loadGroup(), refreshUser()]);
    } catch (err: any) {
      setDuesError(err.message || 'Failed to update dues.');
    } finally {
      setUpdatingDues(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setActionLoading(true);
    try {
      await api.removeMemberFromGroup(id, memberToRemove.id);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
      await loadGroup();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setActionLoading(true);
    try {
      await api.leaveGroup(id);
      router.push('/groups');
    } catch (err: any) {
      alert(err.message);
      setActionLoading(false);
    }
  };

  if (loading || loadingData) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3 px-4">
      <p className="text-red-500 text-center">{error}</p>
      <button onClick={() => router.back()} className="text-indigo-600 text-sm">← Go back</button>
    </div>
  );
  if (!group) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 pt-12 pb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-indigo-200 text-sm mb-4 hover:text-white">
          ← Back to Groups
        </button>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        {group.description && <p className="text-indigo-200 text-sm mt-1">{group.description}</p>}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">
            👥 {group.members?.length || 0} members
          </span>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${isGroupAdmin ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white'}`}>
            {isGroupAdmin ? '⚡ Group Admin' : '👤 Member'}
          </span>
        </div>
        {isGroupAdmin && (
          <div className="mt-4 bg-white/10 rounded-xl px-4 py-3">
            <p className="text-indigo-200 text-xs mb-1">🔑 Invite Code — members can join using this code</p>
            <div className="flex items-center justify-between">
              <p className="font-mono font-bold text-2xl tracking-widest">{group.invite_code}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(group.invite_code); }}
                className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                📋 Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex sticky top-0 z-10 shadow-sm">
        {(['members', 'expenses', 'dues'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {t === 'members' && '👥 '}
            {t === 'expenses' && '📋 '}
            {t === 'dues' && '💰 '}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <div className="space-y-4">

            {isGroupAdmin ? (
              <button
                onClick={() => { setShowAddMember(true); setAddMemberError(''); setAddMemberSuccess(''); setMemberEmail(''); }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                ➕ Add New Member
              </button>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                ℹ️ Only the group admin can add new members to this group.
              </div>
            )}

            <div className="space-y-3">
              {group.members?.map((m: any) => (
                <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-indigo-100 rounded-full w-11 h-11 flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
                        {m.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">{m.name}</p>
                          {m.id === user?.id && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">You</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                            {m.role === 'admin' ? '⚡ Admin' : 'Member'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{m.email}</p>
                        <p className={`text-xs font-semibold mt-1 ${parseFloat(m.balance) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          Balance: {parseFloat(m.balance) >= 0 ? '+' : ''}{parseFloat(m.balance || 0).toFixed(2)} PKR
                        </p>
                      </div>
                    </div>
                    {isGroupAdmin && m.id !== user?.id && (
                      <button
                        onClick={() => { setMemberToRemove(m); setShowRemoveConfirm(true); }}
                        className="flex-shrink-0 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                      >
                        🗑️ Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Leave Group section for regular members */}
            {!isGroupAdmin && (
              <div className="mt-6 border-t border-gray-100 pt-5">
                <div className={`rounded-xl p-4 border ${
                  !duesLoaded ? 'bg-gray-50 border-gray-100' :
                  canLeave ? 'bg-green-50 border-green-100' :
                  'bg-red-50 border-red-100'
                }`}>
                  <p className="font-semibold text-gray-800 text-sm mb-2">🚪 Leave this Group</p>

                  {!duesLoaded && (
                    <p className="text-xs text-gray-400 mb-3">Checking your balance...</p>
                  )}

                  {duesLoaded && canLeave && myBalance === 0 && (
                    <p className="text-xs text-green-700 mb-3">
                      ✅ Your balance is <strong>0 PKR</strong> — all dues are cleared. You can safely leave.
                    </p>
                  )}

                  {duesLoaded && canLeave && myBalance > 0 && (
                    <p className="text-xs text-green-700 mb-3">
                      ✅ Your balance is <strong>+{myBalance.toFixed(2)} PKR</strong> — you are in credit. You can leave the group.
                    </p>
                  )}

                  {duesLoaded && !canLeave && (
                    <div className="mb-3">
                      <p className="text-xs text-red-600 font-medium mb-1">
                        ❌ You cannot leave yet — you owe <strong>{Math.abs(myBalance!).toFixed(2)} PKR</strong>
                      </p>
                      <p className="text-xs text-red-500">
                        Submit your payment receipt to the admin. Once approved, your balance will be updated and you can leave.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => canLeave && setShowLeaveConfirm(true)}
                    disabled={!canLeave || !duesLoaded}
                    className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                      canLeave ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {!duesLoaded ? '⏳ Loading...' : canLeave ? '🚪 Leave Group' : `🔒 Clear ${Math.abs(myBalance!).toFixed(2)} PKR dues to leave`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EXPENSES TAB ── */}
        {tab === 'expenses' && (
          <div className="space-y-3">
            {isGroupAdmin ? (
              <button
                onClick={() => router.push(`/expenses/new?group_id=${id}`)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                ➕ Add New Expense
              </button>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                ℹ️ Only the group admin can add expenses. You will be notified when a new expense is added.
              </div>
            )}



            {expenses.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">📋</div>
                <p className="font-medium text-gray-600">No expenses yet</p>
                <p className="text-sm text-gray-400 mt-1">Tap "Add New Expense" to get started</p>
              </div>
            ) : (
              expenses.map((e: any) => (
                <div key={e.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">{e.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Added by {e.users?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(e.expense_date || e.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{e.total_amount} PKR</p>
                      <p className="text-xs text-red-500 mt-0.5">Your share: -{e.per_person_amount} PKR</p>
                      <p className="text-xs text-gray-400 mt-0.5">÷ {e.participant_count} people</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── DUES TAB ── */}
        {tab === 'dues' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 border text-sm ${isGroupAdmin ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
              {isGroupAdmin
                ? '⚡ As group admin, tap "Update Dues" on any member to adjust their balance after they pay.'
                : '💡 This shows everyone\'s current balance. Negative means they owe money.'}
            </div>

            <div className="space-y-3">
              {dues.map((m: any) => (
                <div key={m.id} className={`bg-white rounded-xl p-4 shadow-sm border ${parseFloat(m.balance) < 0 ? 'border-red-100' : 'border-green-100'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`rounded-full w-11 h-11 flex items-center justify-center font-bold text-lg flex-shrink-0 ${parseFloat(m.balance) < 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {m.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 text-sm">{m.name}</p>
                          {m.id === user?.id && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">You</span>}
                        </div>
                        {m.last_payment && (
                          <p className="text-xs text-green-600 mt-0.5">✓ Last paid: {parseFloat(m.last_payment.amount).toFixed(2)} PKR</p>
                        )}
                        <p className={`text-xs font-medium mt-0.5 ${parseFloat(m.balance) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {parseFloat(m.balance) < 0 ? '🔴 Owes dues' : '🟢 All clear'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-lg ${parseFloat(m.balance) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {parseFloat(m.balance) >= 0 ? '+' : ''}{parseFloat(m.balance || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">PKR</p>
                      {isGroupAdmin && (
                        <button
                          onClick={() => { setSelectedMember(m); setAdjustment(''); setDuesNotes(''); setDuesError(''); setShowUpdateDues(true); }}
                          className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          {m.id === user?.id ? '💳 Clear My Dues' : '✏️ Update Dues'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {duesHistory.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-700 text-sm mb-3 mt-2">📜 Dues Update History</h3>
                <div className="space-y-2">
                  {duesHistory.map((d: any) => (
                    <div key={d.id} className="bg-white rounded-xl p-3 border border-gray-100 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-700">{d.users?.name}</p>
                          <p className="text-gray-400 mt-0.5">Updated by {d.updater?.name}</p>
                          {d.notes && <p className="text-gray-500 mt-0.5 italic">"{d.notes}"</p>}
                          <p className="text-gray-300 mt-0.5">{new Date(d.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${parseFloat(d.balance_adjustment) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {parseFloat(d.balance_adjustment) >= 0 ? '+' : ''}{d.balance_adjustment} PKR
                          </p>
                          <p className="text-gray-400 mt-0.5">{d.balance_before} → {d.balance_after}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {showAddMember && (
        <Modal title="➕ Add New Member" onClose={() => setShowAddMember(false)}>
          <p className="text-sm text-gray-500 mb-4">Enter their email address. They will receive an invitation in their Alerts and can Accept or Decline.</p>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={memberEmail}
                onChange={e => setMemberEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                autoFocus
              />
            </div>
            {addMemberError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">❌ {addMemberError}</div>
            )}
            {addMemberSuccess && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">✅ {addMemberSuccess}</div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddMember(false)} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={addingMember} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-colors">
                {addingMember ? 'Adding...' : '➕ Add Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showUpdateDues && selectedMember && (
        <Modal
          title="✏️ Update Member Dues"
          onClose={() => setShowUpdateDues(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowUpdateDues(false)} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateDues as any}
                disabled={updatingDues || !adjustment}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {updatingDues ? 'Updating...' : '✅ Confirm Update'}
              </button>
            </div>
          }
        >
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-sm font-semibold text-gray-800">{selectedMember.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">Current balance:
              <span className={`font-bold ml-1 ${parseFloat(selectedMember.balance) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {parseFloat(selectedMember.balance || 0).toFixed(2)} PKR
              </span>
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick amounts</label>
              <div className="flex gap-2 mb-3">
                {['500', '1000', '2000', '5000'].map(v => (
                  <button key={v} type="button" onClick={() => setAdjustment(v)}
                    className={`flex-1 border rounded-lg py-2 text-xs font-medium transition-colors ${adjustment === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    +{v}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={adjustment}
                onChange={e => setAdjustment(e.target.value)}
                placeholder="Or enter custom amount (negative to deduct)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-400 mt-1">Positive = credit (paid dues) · Negative = deduct</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes (optional)</label>
              <input
                type="text"
                value={duesNotes}
                onChange={e => setDuesNotes(e.target.value)}
                placeholder="e.g. Paid cash on 5th March"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {adjustment && !isNaN(parseFloat(adjustment)) && (
              <div className={`rounded-xl p-3 text-sm font-medium ${parseFloat(adjustment) >= 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                New balance will be: <strong>{(parseFloat(selectedMember.balance || 0) + parseFloat(adjustment)).toFixed(2)} PKR</strong>
              </div>
            )}
            {duesError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">❌ {duesError}</div>
            )}
          </div>
        </Modal>
      )}

      {showRemoveConfirm && memberToRemove && (
        <ConfirmDialog
          title="🗑️ Remove Member"
          message={`Are you sure you want to remove ${memberToRemove.name} from this group? Their current balance is ${parseFloat(memberToRemove.balance || 0).toFixed(2)} PKR.`}
          confirmLabel="Yes, Remove Member"
          confirmClass="bg-red-500 hover:bg-red-600"
          onConfirm={handleRemoveMember}
          onCancel={() => { setShowRemoveConfirm(false); setMemberToRemove(null); }}
          loading={actionLoading}
        />
      )}

      {showLeaveConfirm && (
        <ConfirmDialog
          title="🚪 Leave Group"
          message={`Are you sure you want to leave "${group.name}"? You will no longer see this group's expenses or dues.`}
          confirmLabel="Yes, Leave Group"
          confirmClass="bg-red-500 hover:bg-red-600"
          onConfirm={handleLeaveGroup}
          onCancel={() => setShowLeaveConfirm(false)}
          loading={actionLoading}
        />
      )}

      <BottomNav />
    </div>
  );
}