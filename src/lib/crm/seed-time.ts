/** "Now" for priority, staleness and relative dates. It was pinned to
 *  2026-08-06 for demos, which made live data read as "Future" and every
 *  staleness check wrong (RIV-1534). Seed rows are built relative to it, so
 *  local mock data still looks the same. */
export const DEMO_NOW = Date.now();

export function ago(days: number, hours = 0): string {
  return new Date(DEMO_NOW - days * 86400000 - hours * 3600000).toISOString();
}
export function inDays(days: number): string {
  return new Date(DEMO_NOW + days * 86400000).toISOString().slice(0, 10);
}
export function dateAgo(days: number): string {
  return ago(days).slice(0, 10);
}
