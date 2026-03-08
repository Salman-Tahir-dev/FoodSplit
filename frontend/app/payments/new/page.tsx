'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import BottomNav from '../../../components/layout/BottomNav';

export default function NewPaymentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading]);

  useEffect(() => {
    if (user) api.getGroups().then(d => setGroups((d as any).groups)).catch(console.error);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return setError('Please enter a valid amount');

    setSubmitting(true);
    setError('');
    let receiptUrl = '';

    try {
      // Upload file if selected
      if (file) {
        setUploadProgress('Getting upload URL...');
        const urlData = await api.getStorageUrl(file.name, file.type) as any;
        
        setUploadProgress('Uploading receipt...');
        // Upload to Supabase storage using the signed URL
        const uploadRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload receipt image');
        }
        
        receiptUrl = urlData.fullPath;
        setUploadProgress('');
      }

      setUploadProgress('Submitting payment...');
      await api.submitPayment({
        amount: parseFloat(amount),
        group_id: groupId || undefined,
        receipt_url: receiptUrl || undefined,
        notes: notes || undefined,
      });

      router.push('/payments');
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment');
      setUploadProgress('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="text-indigo-600 text-sm mb-2">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Submit Payment</h1>
        <p className="text-sm text-gray-500 mt-1">Submit your payment for admin review</p>
      </div>

      <div className="px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (PKR) *</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="500"
              min="1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group (optional)</label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">No specific group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Screenshot</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 transition-colors"
            >
              {file ? (
                <div>
                  <p className="text-green-600 font-medium text-sm">✓ {file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">📷</p>
                  <p className="text-sm text-gray-500">Tap to upload receipt</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Paid via EasyPaisa"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <p>ℹ️ Your payment will be reviewed by the admin. Once approved, your balance will be updated automatically.</p>
          </div>

          {uploadProgress && (
            <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700 text-center">
              ⏳ {uploadProgress}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Payment'}
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}
