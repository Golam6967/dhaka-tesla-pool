export function formatPaisa(paisa) {
  return `৳${(paisa / 100).toFixed(2)}`;
}
