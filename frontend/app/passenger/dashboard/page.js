'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../providers';
import RequireRole from '../../../components/RequireRole';
import Spinner from '../../../components/Spinner';
import ErrorBanner from '../../../components/ErrorBanner';
import EmptyState from '../../../components/EmptyState';
import RideRequestCard from '../../../components/RideRequestCard';

function PassengerDashboard() {
  const { session } = useAuth();
  const [zones, setZones] = useState([]);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [pickupZoneId, setPickupZoneId] = useState('');
  const [destinationZoneId, setDestinationZoneId] = useState('');
  const [seatsRequested, setSeatsRequested] = useState(1);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState(null);

  // A ref (not state) so this guard survives without being a stale closure
  // dependency — loadData runs after every create/cancel, and defaults must
  // only ever be applied once, on the very first successful load.
  const defaultsApplied = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [zonesRes, ridesRes] = await Promise.all([
        apiFetch('/api/zones'),
        apiFetch('/api/ride-requests', { token: session.token }),
      ]);
      setZones(zonesRes.zones);
      setRides(ridesRes.rideRequests);
      if (zonesRes.zones.length > 0 && !defaultsApplied.current) {
        defaultsApplied.current = true;
        setPickupZoneId(zonesRes.zones[0].id);
        setDestinationZoneId(zonesRes.zones[0].id);
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function zoneName(id) {
    return zones.find((z) => z.id === id)?.name || 'Unknown zone';
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/ride-requests', {
        method: 'POST',
        token: session.token,
        body: {
          pickupZoneId,
          destinationZoneId,
          seatsRequested: Number(seatsRequested),
        },
      });
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(rideId) {
    setCancelError(null);
    setCancellingId(rideId);
    try {
      await apiFetch(`/api/ride-requests/${rideId}/cancel`, {
        method: 'POST',
        token: session.token,
      });
      await loadData();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h2 className="card-title">Request a ride</h2>
        <p className="card-subtitle">Pick your pickup and destination zones.</p>
        <ErrorBanner message={formError} />
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="pickup">Pickup zone</label>
            <select id="pickup" value={pickupZoneId} onChange={(e) => setPickupZoneId(e.target.value)} required>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="destination">Destination zone</label>
            <select
              id="destination"
              value={destinationZoneId}
              onChange={(e) => setDestinationZoneId(e.target.value)}
              required
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="seats">Seats</label>
            <input
              id="seats"
              type="number"
              min={1}
              max={4}
              value={seatsRequested}
              onChange={(e) => setSeatsRequested(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting || zones.length === 0}>
            {submitting ? 'Requesting…' : 'Request ride'}
          </button>
        </form>
      </div>

      <h3 style={{ margin: '24px 0 12px' }}>My rides</h3>
      <ErrorBanner message={cancelError} />
      {loading && <Spinner label="Loading your rides…" />}
      {!loading && loadError && <ErrorBanner message={loadError} />}
      {!loading && !loadError && rides.length === 0 && (
        <EmptyState>You haven&apos;t requested any rides yet.</EmptyState>
      )}
      {!loading &&
        !loadError &&
        rides.map((ride) => (
          <RideRequestCard
            key={ride.id}
            ride={ride}
            zoneName={zoneName}
            onCancel={handleCancel}
            cancelling={cancellingId === ride.id}
          />
        ))}
    </div>
  );
}

export default function PassengerDashboardPage() {
  return (
    <RequireRole role="passenger">
      <PassengerDashboard />
    </RequireRole>
  );
}
