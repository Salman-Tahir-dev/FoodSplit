'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(145deg, #FF7043 0%, #FF8A65 40%, #FFAB91 70%, #FFF3E0 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px',
        width: '280px', height: '280px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-60px', left: '-60px',
        width: '220px', height: '220px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.10)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '35%', left: '-40px',
        width: '140px', height: '140px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', pointerEvents: 'none',
      }} />

      {/* Top branding */}
      <div style={{ textAlign: 'center', marginBottom: '28px', zIndex: 1 }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '22px',
          background: 'white', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 14px',
          boxShadow: '0 8px 32px rgba(230,74,25,0.25)',
          fontSize: '36px',
        }}>🍕</div>
        <h1 style={{
          fontSize: '32px', fontWeight: 800, color: 'white',
          letterSpacing: '-0.5px', margin: 0,
          textShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}>FoodSplit</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', marginTop: '6px', fontWeight: 400 }}>
          Split meals, not friendships 🤝
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'white',
        borderRadius: '28px',
        padding: '32px 28px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        zIndex: 1,
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 6px' }}>Welcome back 👋</h2>
        <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>Sign in to continue to your groups</p>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#dc2626', borderRadius: '12px', padding: '12px 14px',
            fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px', letterSpacing: '0.02em' }}>
              EMAIL ADDRESS
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '16px', pointerEvents: 'none',
              }}>✉️</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%', border: '2px solid #f3f4f6', borderRadius: '14px',
                  padding: '13px 14px 13px 42px', fontSize: '15px',
                  outline: 'none', boxSizing: 'border-box', color: '#111',
                  background: '#fafafa', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#FF7043'}
                onBlur={e => e.target.style.borderColor = '#f3f4f6'}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px', letterSpacing: '0.02em' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '16px', pointerEvents: 'none',
              }}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', border: '2px solid #f3f4f6', borderRadius: '14px',
                  padding: '13px 48px 13px 42px', fontSize: '15px',
                  outline: 'none', boxSizing: 'border-box', color: '#111',
                  background: '#fafafa', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#FF7043'}
                onBlur={e => e.target.style.borderColor = '#f3f4f6'}
              />
              {/* Show/Hide toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px',
                  padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9ca3af',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  // Eye-off SVG
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  // Eye SVG
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: 'right', marginTop: '-12px', marginBottom: '20px' }}>
            <Link href="/auth/forgot-password" style={{ fontSize: '13px', color: '#FF7043', textDecoration: 'none', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '15px',
              background: loading ? '#FFAB91' : 'linear-gradient(135deg, #FF7043, #E64A19)',
              color: 'white', border: 'none', borderRadius: '14px',
              fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(255,112,67,0.45)',
              transition: 'all 0.2s', letterSpacing: '0.02em',
            }}
          >
            {loading ? '⏳ Signing in...' : 'Sign In →'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#f3f4f6' }} />
          <span style={{ fontSize: '13px', color: '#d1d5db' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#f3f4f6' }} />
        </div>

        {/* Sign up link */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Don't have an account? </span>
          <Link href="/auth/signup" style={{ fontSize: '14px', color: '#FF7043', fontWeight: 700, textDecoration: 'none' }}>
            Sign up free
          </Link>
        </div>
      </div>

      {/* Bottom tagline */}
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '24px', zIndex: 1 }}>
        🍽️ Track expenses · Split fairly · Stay friends
      </p>
    </div>
  );
}