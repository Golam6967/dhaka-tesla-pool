'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../providers';
import RequireRole from '../../../components/RequireRole';
import Spinner from '../../../components/Spinner';
import ErrorBanner from '../../../components/ErrorBanner';
import EmptyState from '../../../components/EmptyState';
import StatusBadge from '../../../components/StatusBadge';
import AvailableRequestCard from '../../../components/AvailableRequestCard';
import PoolMemberCard from '../../../components/PoolMemberCard';

function DriverDashboard() {
  const { session } = useAuth();
  const [zones, setZones] = useState([]);
  const [tesla, setTesla] = useState(null);
  const [pool, setPool] = useState(null);
  const [members, setMembers] = useState([]);
  const [availableRequests, setAvailableRequests] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [actingOn, setActingOn] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [zonesRes, activePoolRes, availableRes, historyRes] = await Promise.all([
        apiFetch('/api/zones'),
        apiFetch('/api/drivers/me/active-pool', { token: session.token }),
        apiFetch('/api/drivers/me/available-requests', { token: session.token }),
        apiFetch('/api/drivers/me/history', { token: session.token }),
      ]);
      setZones(zonesRes.zones);
      setTesla(activePoolRes.tesla);
      setPool(activePoolRes.pool);
      setMembers(activePoolRes.members);
      setAvailableRequests(availableRes.rideRequests);
      setHistory(historyRes.pools);
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

  async function handleToggleStatus() {
    setToggling(true);
    setActionError(null);
    try {
      const nextStatus = tesla.status === 'online' ? 'offline' : 'online';
      await apiFetch('/api/drivers/me/status', {
        method: 'PATCH',
        token: session.token,
        body: { status: nextStatus },
      });
      await loadData();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setToggling(false);
    }
  }

  async function handleAccept(rideRequestId) {
    setAcceptingId(rideRequestId);
    setActionError(null);
    try {
      await apiFetch('/api/pools/accept', {
        method: 'POST',
        token: session.token,
        body: { rideRequestId },
      });
      await loadData();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleMemberAction(rideRequestId, action) {
    setActingOn(rideRequestId);
    setActionError(null);
    try {
      await apiFetch(`/api/ride-requests/${rideRequestId}/${action}`, {
        method: 'POST',
        token: session.token,
      });
      await loadData();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingOn(null);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <Spinner label="Loading your dashboard…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page">
        <ErrorBanner message={loadError} />
      </div>
    );
  }

  const remainingSeats = pool ? tesla.capacity - pool.seatsOccupied : tesla.capacity;

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <div>
            <p className="card-title">{tesla.label}</p>
            <p className="card-subtitle">
              {tesla.capacity} seats · {remainingSeats} remaining
              {pool ? <> · pool is <StatusBadge status={pool.status} /></> : null}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <StatusBadge status={tesla.status} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleToggleStatus} disabled={toggling}>
              {toggling ? 'Updating…' : tesla.status === 'online' ? 'Go offline' : 'Go online'}
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner message={actionError} />

      <h3 style={{ margin: '24px 0 12px' }}>My pool</h3>
      {members.length === 0 ? (
        <EmptyState>No passengers matched yet.</EmptyState>
      ) : (
        <div className="card">
          {members.map((member) => (
            <PoolMemberCard
              key={member.rideRequest.id}
              member={member}
              zoneName={zoneName}
              onAction={handleMemberAction}
              actingOn={actingOn}
            />
          ))}
        </div>
      )}

      <h3 style={{ margin: '24px 0 12px' }}>Available requests</h3>
      {availableRequests.length === 0 ? (
        <EmptyState>No compatible pending requests right now.</EmptyState>
      ) : (
        availableRequests.map((request) => (
          <AvailableRequestCard
            key={request.id}
            request={request}
            zoneName={zoneName}
            onAccept={handleAccept}
            accepting={acceptingId === request.id}
            disabled={tesla.status !== 'online'}
          />
        ))
      )}

      <h3 style={{ margin: '24px 0 12px' }}>Ride history</h3>
      {history.length === 0 ? (
        <EmptyState>No completed or cancelled pools yet.</EmptyState>
      ) : (
        history.map((entry) => (
          <div className="card" key={entry.pool.id}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {new Date(entry.pool.createdAt).toLocaleString()}
              </span>
              <StatusBadge status={entry.pool.status} />
            </div>
            {entry.members.map((member) => (
              <PoolMemberCard
                key={member.rideRequest.id}
                member={member}
                zoneName={zoneName}
                onAction={() => {}}
                actingOn={null}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export default function DriverDashboardPage() {
  return (
    <RequireRole role="driver">
      <DriverDashboard />
    </RequireRole>
  );
}
