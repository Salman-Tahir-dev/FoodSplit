'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import BottomNav from '../../components/layout/BottomNav';

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      api.getGroups()
        .then(d => setGroups((d as any).groups))
        .catch(console.error)
        .finally(() => setLoadingGroups(false));
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Group name is required');
    setCreating(true);
    setError('');
    try {
      const d = await api.createGroup(name.trim(), description.trim()) as any;
      setGroups(prev => [{ ...d.group, my_role: 'admin' }, ...prev]);
      setShowCreate(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const closeModal = () => {
    setShowCreate(false);
    setName(''); setDescription(''); setError('');
  };
  const closeJoinModal = () => {
    setShowJoinCode(false);
    setJoinCode(''); setJoinError('');
  };
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return setJoinError('Enter an invite code');
    setJoining(true); setJoinError('');
    try {
      const d = await api.joinByCode(joinCode.trim()) as any;
      closeJoinModal();
      router.push(`/groups/${d.group_id}`);
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Groups</h1>
          <p className="text-xs text-gray-400 mt-0.5">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoinCode(true)}
            className="border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            🔑 Join
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1 transition-colors"
          >
            ➕ New
          </button>
        </div>
      </div>

      {/* Groups list */}
      <div className="px-4 py-4 space-y-3">
        {loadingGroups ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">👥</div>
            <p className="font-semibold text-gray-600 text-lg">No groups yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-6">Create a group to start splitting expenses</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold"
            >
              ➕ Create Your First Group
            </button>
          </div>
        ) : (
          groups.map(g => (
            <Link key={g.id} href={`/groups/${g.id}`} className="block bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-indigo-100 rounded-full w-12 h-12 flex items-center justify-center text-indigo-700 font-bold text-xl flex-shrink-0">
                    {g.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{g.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{g.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${g.my_role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                    {g.my_role === 'admin' ? '⚡ Admin' : '👤 Member'}
                  </span>
                  <span className="text-gray-300 text-lg">›</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-base">➕ Create New Group</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-3xl leading-none w-8 h-8 flex items-center justify-center">&times;</button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-5">
              <p className="text-sm text-gray-500 mb-4">Fill in the details below to create your group. You will be set as the group admin.</p>

              <form onSubmit={handleCreate} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                    ❌ {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Flat 3B Expenses"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    autoFocus
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Monthly food & utilities split"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    maxLength={200}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  💡 After creating, go into the group and use <strong>"Add New Member"</strong> to invite people by their email.
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !name.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {creating ? '⏳ Creating...' : '✅ Create Group'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Join by Code Modal */}
      {showJoinCode && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-base">🔑 Join a Group</h2>
              <button onClick={closeJoinModal} className="text-gray-400 text-3xl leading-none">&times;</button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-gray-500 mb-4">Enter the invite code shared by your group admin to join instantly.</p>
              <form onSubmit={handleJoinByCode} className="space-y-4">
                {joinError && <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-sm">❌ {joinError}</div>}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Invite Code</label>
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. D69517FC"
                    maxLength={12}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeJoinModal} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600">Cancel</button>
                  <button type="submit" disabled={joining || !joinCode.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-colors">
                    {joining ? '⏳ Joining...' : '✅ Join Group'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}