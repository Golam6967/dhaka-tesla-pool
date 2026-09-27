'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../providers';
import ErrorBanner from '../../components/ErrorBanner';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { phone, password },
      });
      login({ token, userId: user.id, name: user.name, role: user.role });
      router.push(user.role === 'driver' ? '/driver/dashboard' : '/passenger/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2 className="card-title">Log in</h2>
        <p className="card-subtitle">Passengers and drivers use the same login.</p>
        <ErrorBanner message={error} />
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801700000002"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          No account? <Link href="/passenger/signup">Sign up as a passenger</Link> or{' '}
          <Link href="/driver/signup">sign up as a driver</Link>.
        </p>
      </div>
    </div>
  );
}
