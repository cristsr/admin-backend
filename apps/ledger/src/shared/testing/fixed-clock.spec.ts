import { runClockContract } from './contract/clock.contract';
import { FixedClock } from './fixed-clock';

runClockContract(() => new FixedClock(new Date('2026-01-01T00:00:00.000Z')));

describe('FixedClock', () => {
  it('returns the pinned instant', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('advanceBy moves time forward deterministically', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.advanceBy(60_000);

    expect(clock.now().toISOString()).toBe('2026-01-01T00:01:00.000Z');
  });

  it('never lets a caller mutate the pinned instant', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.now().setTime(0);

    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
