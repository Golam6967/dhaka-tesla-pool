import StatusBadge from './StatusBadge';
import { formatPaisa } from '../lib/money';

const CANCELLABLE_STATUSES = ['requested', 'matched'];

export default function RideRequestCard({ ride, zoneName, onCancel, cancelling }) {
  const canCancel = CANCELLABLE_STATUSES.includes(ride.status);

  return (
    <div className="card">
      <div className="row">
        <div>
          <p className="card-title">
            {zoneName(ride.pickupZoneId)} → {zoneName(ride.destinationZoneId)}
          </p>
          <p className="card-subtitle">
            {ride.seatsRequested} seat{ride.seatsRequested > 1 ? 's' : ''} · requested{' '}
            {new Date(ride.requestedAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      {ride.fare && (
        <div className="fare-breakdown">
          <span>Base fare: {formatPaisa(ride.fare.baseFarePaisa)}</span>
          <span>Distance charge: {formatPaisa(ride.fare.distanceChargePaisa)}</span>
          {ride.fare.poolDiscountPaisa > 0 && (
            <span>Pool discount: −{formatPaisa(ride.fare.poolDiscountPaisa)}</span>
          )}
          <span className="fare-total">Total: {formatPaisa(ride.fare.totalFarePaisa)}</span>
        </div>
      )}

      {canCancel && (
        <div className="actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => onCancel(ride.id)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Cancel ride'}
          </button>
        </div>
      )}
    </div>
  );
}
