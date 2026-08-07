/** Fixed "now" so demo priority stays stable across reloads. */
export const DEMO_NOW = new Date("2026-08-06T21:00:00-06:00").getTime();

export function ago(days: number, hours = 0): string {
  return new Date(DEMO_NOW - days * 86400000 - hours * 3600000).toISOString();
}
export function inDays(days: number): string {
  return new Date(DEMO_NOW + days * 86400000).toISOString().slice(0, 10);
}
export function dateAgo(days: number): string {
  return ago(days).slice(0, 10);
}
