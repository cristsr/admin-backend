/**
 * How often a scheduled movement repeats. Stored as varchar; the allowed
 * values live here, in the application layer.
 *
 * Replaces the previous `repeat` boolean, which said that something recurred
 * but never how often — so nothing could advance it to its next occurrence.
 */
export enum Frequency {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}
