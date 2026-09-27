export default function AvailableRequestCard({ request, zoneName, onAccept, accepting, disabled }) {
  return (
    <div className="card">
      <div className="row">
        <div>
          <p className="card-title">
            {zoneName(request.pickupZoneId)} → {zoneName(request.destinationZoneId)}
          </p>
          <p className="card-subtitle">
            {request.seatsRequested} seat{request.seatsRequested > 1 ? 's' : ''} · requested{' '}
            {new Date(request.requestedAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onAccept(request.id)}
          disabled={accepting || disabled}
          title={disabled ? 'Go online to accept ride requests' : undefined}
        >
          {accepting ? 'Accepting…' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
