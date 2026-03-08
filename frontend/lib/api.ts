const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // Auth
  signup(name: string, email: string, password: string) {
    return this.request('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  }
  login(email: string, password: string) {
    return this.request<{ user: any; session: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  }
  logout() { return this.request('/auth/logout', { method: 'POST' }); }
  forgotPassword(email: string) {
    return this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  }
  getMe() { return this.request<{ user: any }>('/auth/me'); }

  // Dashboard
  getDashboard() { return this.request<any>('/dashboard'); }

  // Groups
  getGroups() { return this.request<{ groups: any[] }>('/groups'); }
  getGroup(id: string) { return this.request<{ group: any }>(`/groups/${id}`); }
  createGroup(name: string, description?: string) {
    return this.request<{ group: any }>('/groups', { method: 'POST', body: JSON.stringify({ name, description }) });
  }
  // Group admin only: add member by email
  addMemberToGroup(groupId: string, userEmail: string) {
    return this.request('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, user_email: userEmail }),
    });
  }
  // Group admin only: remove a member
  removeMemberFromGroup(groupId: string, userId: string) {
    return this.request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
  }
  // Member: leave a group (only if balance >= 0)
  leaveGroup(groupId: string) {
    return this.request(`/groups/${groupId}/leave`, { method: 'DELETE' });
  }
  getGroupDues(groupId: string) {
    return this.request<{ dues: any[] }>(`/groups/${groupId}/dues`);
  }
  getGroupDuesHistory(groupId: string) {
    return this.request<{ dues_history: any[] }>(`/groups/${groupId}/dues-history`);
  }
  updateMemberDues(groupId: string, userId: string, balanceAdjustment: number, notes?: string) {
    return this.request(`/groups/${groupId}/members/${userId}/dues`, {
      method: 'PATCH',
      body: JSON.stringify({ balance_adjustment: balanceAdjustment, notes }),
    });
  }
  changeMemberRole(groupId: string, userId: string, role: 'admin' | 'member') {
    return this.request(`/groups/${groupId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  // Expenses
  getExpenses(groupId?: string) {
    const q = groupId ? `?group_id=${groupId}` : '';
    return this.request<{ expenses: any[] }>(`/expenses${q}`);
  }
  getExpense(id: string) { return this.request<{ expense: any }>(`/expenses/${id}`); }
  createExpense(data: { group_id: string; title: string; description?: string; total_amount: number; participant_ids: string[]; expense_date?: string }) {
    return this.request<{ expense: any }>('/expenses', { method: 'POST', body: JSON.stringify(data) });
  }
  deleteExpense(id: string) { return this.request(`/expenses/${id}`, { method: 'DELETE' }); }

  // Payments
  getStorageUrl(fileName: string, fileType: string) {
    return this.request<{ signedUrl: string; path: string; token: string; fullPath: string }>(
      '/payments/storage-url', { method: 'POST', body: JSON.stringify({ fileName, fileType }) }
    );
  }
  async uploadFile(signedUrl: string, file: File): Promise<void> {
    const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    if (!res.ok) throw new Error('File upload failed');
  }
  submitPayment(data: { amount: number; group_id?: string; receipt_url?: string; notes?: string }) {
    return this.request<{ payment: any }>('/payments/upload-receipt', { method: 'POST', body: JSON.stringify(data) });
  }
  getPayments(params?: { group_id?: string; status?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return this.request<{ payments: any[] }>(`/payments${q ? '?' + q : ''}`);
  }
  getPendingPayments() { return this.request<{ payments: any[] }>('/payments/pending'); }
  getReceiptUrl(paymentId: string) {
    return this.request<{ url: string }>(`/payments/receipt-url/${paymentId}`);
  }
  approvePayment(id: string, action: 'approved' | 'rejected', notes?: string) {
    return this.request<{ payment: any }>(`/payments/approve/${id}`, {
      method: 'PATCH', body: JSON.stringify({ action, notes }),
    });
  }

  // Invitations
  sendInvitation(groupId: string, email: string) {
    return this.request('/invitations/send', { method: 'POST', body: JSON.stringify({ group_id: groupId, email }) });
  }
  joinByCode(inviteCode: string) {
    return this.request<{ message: string; group_id: string }>('/invitations/join-by-code', {
      method: 'POST', body: JSON.stringify({ invite_code: inviteCode })
    });
  }
  respondToInvitation(id: string, action: 'accepted' | 'rejected') {
    return this.request<{ message: string; group_id?: string }>(`/invitations/${id}/respond`, {
      method: 'PATCH', body: JSON.stringify({ action })
    });
  }
  getPendingInvitations() {
    return this.request<{ invitations: any[] }>('/invitations/pending');
  }

  // Notifications
  getNotifications(unreadOnly = false) {
    return this.request<{ notifications: any[] }>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`);
  }
  markNotificationRead(id: string) { return this.request(`/notifications/${id}/read`, { method: 'PATCH' }); }
  markAllNotificationsRead() { return this.request('/notifications/read-all', { method: 'PATCH' }); }

  // Admin
  getAdminDashboard() { return this.request<any>('/admin/dashboard'); }
  getAdminUsers() { return this.request<{ users: any[] }>('/admin/users'); }
  updateAdminUser(id: string, updates: { is_admin?: boolean; balance?: number; name?: string }) {
    return this.request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  }
  deleteAdminUser(id: string) { return this.request(`/admin/users/${id}`, { method: 'DELETE' }); }
  getAdminPayments() { return this.request<{ payments: any[] }>('/admin/payments'); }
  deleteAdminExpense(id: string) { return this.request(`/admin/expenses/${id}`, { method: 'DELETE' }); }
  deleteAdminGroup(id: string) { return this.request(`/admin/groups/${id}`, { method: 'DELETE' }); }
}

export const api = new ApiClient();