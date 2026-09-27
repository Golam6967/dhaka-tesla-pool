'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../app/providers';
import Spinner from './Spinner';

export default function RequireRole({ role, children }) {
  const { session, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && (!session || session.role !== role)) {
      router.replace('/login');
    }
  }, [ready, session, role, router]);

  if (!ready || !session || session.role !== role) {
    return <Spinner label="Checking session…" />;
  }

  return children;
}
