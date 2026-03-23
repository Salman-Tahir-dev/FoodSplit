'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import BottomNav from '../../components/layout/BottomNav';

const typeIcon: Record<string, string> = {
  info: '💬', warning: '⚠️', success: '✅', error: '❌', invite: '📩',
};

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) router.push('/auth/login'); }, [user, loading]);

  const loadAll = async () => {
    try {
      const [nData, iData] = await Promise.all([
        api.getNotifications() as any,
        api.getPendingInvitations() as any,
      ]);
      setNotifications(nData.notifications);
      setInvitations(iData.invitations);
    } catch (err) { console.error(err); }
    finally { setFetching(false); }
  };

  useEffect(() => { if (user) loadAll(); }, [user]);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleInviteResponse = async (invitationId: string, action: 'accepted' | 'rejected') => {
    setRespondingId(invitationId + action);
    try {
      const res = await api.respondToInvitation(invitationId, action) as any;
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      if (action === 'accepted' && res.group_id) {
        router.push(`/groups/${res.group_id}`);
      } else {
        await loadAll();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRespondingId(null);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalBadge = invitations.length + unreadCount;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Alerts</h1>
          {totalBadge > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalBadge}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm text-[#FF7043] font-medium">Mark all read</button>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF7043]" />
          </div>
        ) : (
          <>
            {/* ── PENDING INVITATIONS ── */}
            {invitations.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                  📩 Group Invitations ({invitations.length})
                </p>
                {invitations.map(inv => (
                  <div key={inv.id} className="bg-white rounded-2xl p-4 shadow-sm border-2 border-[#FFCCBC]">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-[#FFF3E0] rounded-full w-11 h-11 flex items-center justify-center text-xl flex-shrink-0">
                        👥
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{inv.groups?.name}</p>
                        {inv.groups?.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{inv.groups.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Invited by <strong>{inv.inviter?.name}</strong>
                        </p>
                        <p className="text-xs text-gray-300 mt-0.5">{new Date(inv.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInviteResponse(inv.id, 'rejected')}
                        disabled={!!respondingId}
                        className="flex-1 border-2 border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        {respondingId === inv.id + 'rejected' ? '...' : '❌ Decline'}
                      </button>
                      <button
                        onClick={() => handleInviteResponse(inv.id, 'accepted')}
                        disabled={!!respondingId}
                        className="flex-1 bg-[#FF7043] hover:bg-[#E64A19] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors"
                      >
                        {respondingId === inv.id + 'accepted' ? '⏳ Joining...' : '✅ Accept & Join'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {notifications.length > 0 && (
              <div className="space-y-2">
                {invitations.length > 0 && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2">
                    🔔 Notifications
                  </p>
                )}
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`bg-white rounded-xl p-4 shadow-sm border transition-colors cursor-pointer ${n.is_read ? 'border-gray-100 opacity-60' : 'border-[#FFF3E0]'}`}
                  >
                    <div className="flex gap-3">
                      <span className="text-xl mt-0.5 flex-shrink-0">{typeIcon[n.type] || '💬'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-gray-800 text-sm">{n.title}</p>
                          {!n.is_read && <div className="w-2 h-2 bg-[#FF7043] rounded-full mt-1 ml-2 flex-shrink-0" />}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {invitations.length === 0 && notifications.length === 0 && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🔔</div>
                <p className="font-medium text-gray-600">All caught up!</p>
                <p className="text-sm text-gray-400 mt-1">No notifications or invitations</p>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}