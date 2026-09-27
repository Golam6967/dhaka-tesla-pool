'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../providers';
import ErrorBanner from '../../../components/ErrorBanner';

export default function DriverSignupPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [teslaLabel, setTeslaLabel] = useState('');
  const [teslaCapacity, setTeslaCapacity] = useState(3);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await apiFetch('/api/drivers/signup', {
        method: 'POST',
        body: { name, phone, password, teslaLabel, teslaCapacity: Number(teslaCapacity) },
      });
      login({ token, userId: user.id, name: user.name, role: user.role });
      router.push('/driver/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2 className="card-title">Sign up as a driver</h2>
        <p className="card-subtitle">Register yourself and your Tesla together.</p>
        <ErrorBanner message={error} />
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801700000001"
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
              minLength={6}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="teslaLabel">Tesla name</label>
            <input
              id="teslaLabel"
              value={teslaLabel}
              onChange={(e) => setTeslaLabel(e.target.value)}
              placeholder="Bullet"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="teslaCapacity">Seat capacity</label>
            <input
              id="teslaCapacity"
              type="number"
              min={1}
              max={8}
              value={teslaCapacity}
              onChange={(e) => setTeslaCapacity(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
