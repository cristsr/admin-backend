/**
 * Wall clock as a port so tests pin time instead of depending on the system
 * clock, so doubles are deterministic in tests.
 */
export abstract class Clock {
  /** The current instant; consumers always interpret it as UTC. */
  abstract now(): Date;
}
