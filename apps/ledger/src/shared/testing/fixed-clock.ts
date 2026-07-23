import { Clock } from '@ledger/shared/domain/ports';

/** Deterministic double: returns the pinned instant, advanceable in tests. */
export class FixedClock extends Clock {
  private current: Date;

  constructor(startAt: Date) {
    super();
    this.current = startAt;
  }

  /** A copy, so callers can never mutate the pinned instant. */
  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceBy(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
