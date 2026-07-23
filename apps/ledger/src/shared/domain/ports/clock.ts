/**
 * Wall clock as a port so tests pin time instead of depending on the system
 * clock (spec §3.8: doubles are deterministic in tests).
 */
export abstract class Clock {
  /** The current instant; consumers always interpret it as UTC (RNF-7). */
  abstract now(): Date;
}
