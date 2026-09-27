import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="hero">
      <h1>Dhaka Tesla Pool</h1>
      <p>Ride pooling for Dhaka — request a ride, get matched into a Tesla pool, split the fare.</p>
      <div className="hero-actions">
        <Link href="/passenger/signup" className="btn btn-primary">
          I&apos;m a passenger
        </Link>
        <Link href="/driver/signup" className="btn btn-ghost">
          I&apos;m a driver
        </Link>
      </div>
      <p style={{ marginTop: 24 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
