const LABELS = {
  requested: 'Requested',
  matched: 'Matched',
  driver_arrived: 'Driver arrived',
  started: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  forming: 'Forming',
  active: 'Active',
  online: 'Online',
  offline: 'Offline',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-status-${status}`}>{LABELS[status] || status}</span>;
}
