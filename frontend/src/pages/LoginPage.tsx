import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--color-paper)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 32px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 13H6L9 5L14 19L17 11L19 13H22"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-ink)' }}>
            UpWatch
          </span>
        </div>

        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: '8px', color: 'var(--color-ink)' }}>
          Sign in
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: '24px' }}>
          Monitor your deployed student projects.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(201, 60, 60, 0.1)',
              border: '1px solid var(--color-down)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-down)',
              fontSize: 'var(--text-sm)',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px' }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-line)',
                backgroundColor: 'var(--color-paper)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-base)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '6px' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              required
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-line)',
                backgroundColor: 'var(--color-paper)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-base)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '10px 16px',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textAlign: 'center' }}>
          Need an account?{' '}
          <Link to="/register" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};
