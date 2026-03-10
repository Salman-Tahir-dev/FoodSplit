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

  const handleCreate = async () => {
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

  const closeModal = () => { setShowCreate(false); setName(''); setDescription(''); setError(''); };
  const closeJoinModal = () => { setShowJoinCode(false); setJoinCode(''); setJoinError(''); };

  const handleJoinByCode = async () => {
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
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Groups</h1>
            <p className="text-xs text-gray-400 mt-0.5">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowJoinCode(true)}
              className="border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
            >
              🔑 Join
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              ➕ New
            </button>
          </div>
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
            <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold">
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

      {/* ── Create Group Modal ── z-[200] so it's above BottomNav (z-50) */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[200] flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px 20px 0 0',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85dvh',
              width: '100%',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#111827' }}>➕ Create New Group</span>
              <button onClick={closeModal} style={{ fontSize: '24px', color: '#9ca3af', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>

            {/* Scrollable body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: '1 1 auto' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Fill in the details below to create your group. You will be set as the group admin.</p>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '12px', fontSize: '14px', marginBottom: '12px' }}>❌ {error}</div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Group Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Flat 3B Expenses"
                  maxLength={100}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Description <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Monthly food & utilities split"
                  maxLength={200}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#1d4ed8' }}>
                💡 After creating, go into the group and use <strong>"Add New Member"</strong> to invite people by their email.
              </div>
            </div>

            {/* Footer - ALWAYS visible, never cut off */}
            <div style={{
              flexShrink: 0,
              padding: '12px 20px',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid #f3f4f6',
              background: 'white',
              display: 'flex',
              gap: '12px',
            }}>
              <button
                onClick={closeModal}
                style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 500, color: '#4b5563', background: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                style={{
                  flex: 1, borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 600,
                  color: 'white', background: creating || !name.trim() ? '#a5b4fc' : '#4f46e5',
                  border: 'none', cursor: creating || !name.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {creating ? '⏳ Creating...' : '✅ Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Join by Code Modal ── */}
      {showJoinCode && (
        <div
          className="fixed inset-0 z-[200] flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={closeJoinModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px 20px 0 0',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85dvh',
              width: '100%',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#111827' }}>🔑 Join a Group</span>
              <button onClick={closeJoinModal} style={{ fontSize: '24px', color: '#9ca3af', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: '1 1 auto' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Enter the invite code shared by your group admin to join instantly.</p>
              {joinError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '12px', fontSize: '14px', marginBottom: '12px' }}>❌ {joinError}</div>}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Invite Code</label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. D69517FC"
                  maxLength={12}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center', outline: 'none', textTransform: 'uppercase', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              flexShrink: 0,
              padding: '12px 20px',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid #f3f4f6',
              background: 'white',
              display: 'flex',
              gap: '12px',
            }}>
              <button onClick={closeJoinModal} style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 500, color: '#4b5563', background: 'white', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleJoinByCode}
                disabled={joining || !joinCode.trim()}
                style={{
                  flex: 1, borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 600,
                  color: 'white', background: joining || !joinCode.trim() ? '#a5b4fc' : '#4f46e5',
                  border: 'none', cursor: joining || !joinCode.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {joining ? '⏳ Joining...' : '✅ Join Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}