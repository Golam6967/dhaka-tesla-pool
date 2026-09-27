'use client';

import Link from 'next/link';
import { useAuth } from '../app/providers';

export default function Navbar() {
  const { session, ready, logout } = useAuth();

  return (
    <header className="navbar">
      <Link href="/" className="navbar-brand">
        Dhaka Tesla Pool
      </Link>
      <nav className="navbar-links">
        {ready && session ? (
          <>
            <span className="navbar-user">
              {session.name} <span className="badge badge-role">{session.role}</span>
            </span>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          ready && (
            <>
              <Link href="/login" className="btn btn-ghost">
                Log in
              </Link>
              <Link href="/passenger/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )
        )}
      </nav>
    </header>
  );
}
