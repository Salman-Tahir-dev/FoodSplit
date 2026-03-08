'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import BottomNav from '../../../components/layout/BottomNav';

export default function NewExpensePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGroupId = searchParams.get('group_id') || '';

  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState(preselectedGroupId);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      api.getGroups().then((d: any) => {
        const adminGroups = d.groups.filter((g: any) => g.my_role === 'admin');
        setGroups(adminGroups);
        if (preselectedGroupId) {
          setGroupId(preselectedGroupId);
          loadMembers(preselectedGroupId);
        }
      }).catch(console.error);
    }
  }, [user]);

  const loadMembers = async (gid: string) => {
    if (!gid) return;
    setLoadingMembers(true);
    try {
      const d = await api.getGroup(gid) as any;
      const members = d.group.members || [];
      setGroupMembers(members);
      // Select all by default
      setSelectedParticipants(new Set(members.map((m: any) => m.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleGroupChange = (gid: string) => {
    setGroupId(gid);
    setGroupMembers([]);
    setSelectedParticipants(new Set());
    if (gid) loadMembers(gid);
  };

  const toggleParticipant = (uid: string) => {
    setSelectedParticipants(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const perPersonAmount = amount && selectedParticipants.size > 0
    ? (parseFloat(amount) / selectedParticipants.size).toFixed(2)
    : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return setError('Please select a group');
    if (selectedParticipants.size === 0) return setError('Select at least one participant');
    setSubmitting(true);
    setError('');
    try {
      await api.createExpense({
        group_id: groupId,
        title,
        description,
        total_amount: parseFloat(amount),
        participant_ids: Array.from(selectedParticipants),
      });
      router.push(`/groups/${groupId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (!loading && groups.length === 0 && user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
          <button onClick={() => router.back()} className="text-indigo-600 text-sm mb-2">← Back</button>
          <h1 className="text-xl font-bold text-gray-900">Add Expense</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="font-semibold text-gray-700 text-lg mb-2">Admin Only</p>
          <p className="text-gray-500 text-sm">Only group admins can add expenses.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="text-indigo-600 text-sm mb-2">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Add Expense</h1>
        <p className="text-sm text-gray-500 mt-1">Only charged to selected participants</p>
      </div>

      <div className="px-4 py-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">❌ {error}</div>}

          {/* Group */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Group <span className="text-red-500">*</span></label>
            <select
              value={groupId}
              onChange={e => handleGroupChange(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              required
            >
              <option value="">Select a group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Expense Title <span className="text-red-500">*</span></label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Dinner, Groceries, Electricity bill"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Total Amount (PKR) <span className="text-red-500">*</span></label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              min="1"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Participants */}
          {groupId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Who participated? <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedParticipants(new Set(groupMembers.map((m: any) => m.id)))}
                    className="text-xs text-indigo-600 font-medium hover:underline">All</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={() => setSelectedParticipants(new Set())}
                    className="text-xs text-red-500 font-medium hover:underline">None</button>
                </div>
              </div>

              {loadingMembers ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {groupMembers.map((m: any) => {
                    const selected = selectedParticipants.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleParticipant(m.id)}
                        className={`w-full flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                          selected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-gray-200 text-gray-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${selected ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                            {m.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-sm">{m.name} {m.id === user?.id && '(You)'}</p>
                            <p className="text-xs opacity-60">{m.role === 'admin' ? '⚡ Admin' : 'Member'}</p>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                          {selected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Live split preview */}
              {selectedParticipants.size > 0 && amount && (
                <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-sm font-semibold text-green-800">
                    💰 Split: {parseFloat(amount).toFixed(2)} PKR ÷ {selectedParticipants.size} = <strong>{perPersonAmount} PKR each</strong>
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {selectedParticipants.size === groupMembers.length
                      ? 'All members included'
                      : `${groupMembers.length - selectedParticipants.size} member(s) excluded`}
                  </p>
                </div>
              )}

              {selectedParticipants.size === 0 && (
                <div className="mt-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
                  ⚠️ Select at least one participant
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any extra details..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || selectedParticipants.size === 0 || !amount || !title || !groupId}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 font-semibold disabled:opacity-50 transition-colors"
          >
            {submitting ? '⏳ Adding...' : `➕ Add Expense (${perPersonAmount} PKR × ${selectedParticipants.size})`}
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}