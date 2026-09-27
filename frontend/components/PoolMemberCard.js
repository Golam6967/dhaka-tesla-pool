import StatusBadge from './StatusBadge';
import { formatPaisa } from '../lib/money';

const NEXT_ACTION = {
  matched: { label: 'Mark driver arrived', action: 'arrive' },
  driver_arrived: { label: 'Start ride', action: 'start' },
  started: { label: 'Complete ride', action: 'complete' },
};

export default function PoolMemberCard({ member, zoneName, onAction, actingOn }) {
  const { rideRequest, fare } = member;
  const next = NEXT_ACTION[rideRequest.status];

  return (
    <div className="pool-member">
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>
          {zoneName(rideRequest.pickupZoneId)} → {zoneName(rideRequest.destinationZoneId)}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {rideRequest.seatsRequested} seat{rideRequest.seatsRequested > 1 ? 's' : ''}
          {fare ? ` · ${formatPaisa(fare.totalFarePaisa)}` : ''}
        </p>
      </div>
      <div className="actions">
        <StatusBadge status={rideRequest.status} />
        {next && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onAction(rideRequest.id, next.action)}
            disabled={actingOn === rideRequest.id}
          >
            {actingOn === rideRequest.id ? 'Working…' : next.label}
          </button>
        )}
      </div>
    </div>
  );
}
