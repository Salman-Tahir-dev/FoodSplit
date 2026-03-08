'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Supabase puts the access_token in the URL hash after redirect
  // e.g. /auth/reset-password#access_token=xxx&type=recovery
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    // Parse hash params from URL
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const type = params.get('type');

    if (token && type === 'recovery') {
      setAccessToken(token);
    } else {
      // Also check query params (some setups use query string)
      const searchParams = new URLSearchParams(window.location.search);
      const qToken = searchParams.get('access_token') || searchParams.get('token');
      if (qToken) setAccessToken(qToken);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (!accessToken) return setError('Invalid or expired reset link. Please request a new one.');

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
          <p className="text-gray-500 mt-1 text-sm">Enter and confirm your new password below</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {success ? (
            <div className="text-center space-y-4 py-2">
              <div className="text-5xl">✅</div>
              <p className="font-semibold text-gray-800">Password updated!</p>
              <p className="text-sm text-gray-500">Redirecting you to login...</p>
              <Link href="/auth/login" className="block text-indigo-600 text-sm hover:underline">
                Go to login now →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">❌ {error}</div>
              )}

              {!accessToken && (
                <div className="bg-yellow-50 border border-yellow-100 text-yellow-700 rounded-xl p-3 text-sm">
                  ⚠️ No reset token found. Please use the link from your email directly.
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className={`w-full border rounded-xl px-3 py-3 text-sm pr-10 focus:outline-none focus:ring-2 ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-red-300 focus:ring-red-400'
                        : 'border-gray-200 focus:ring-indigo-500'
                    }`}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
                {confirmPassword && password === confirmPassword && password.length >= 6 && (
                  <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !accessToken || password !== confirmPassword || password.length < 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {loading ? '⏳ Updating...' : '🔒 Set New Password'}
              </button>

              <p className="text-center text-sm">
                <Link href="/auth/login" className="text-indigo-600 hover:underline">← Back to login</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}