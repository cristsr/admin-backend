import { Clock } from '@cqrs/domain/ports';
import { defineContract } from './define-contract';

/**
 * The reusable contract for any Clock. Each adapter's spec invokes this
 * runner so the deterministic double and the real adapter prove identical
 * behaviour (RNF-11).
 */
export function runClockContract(makeClock: () => Clock): void {
  defineContract('Clock contract', [
    {
      name: 'returns a Date in UTC',
      verify: () => {
        const now = makeClock().now();

        expect(now).toBeInstanceOf(Date);
        expect(Number.isNaN(now.getTime())).toBe(false);
      },
    },
    {
      name: 'never returns a time before the previous call',
      verify: () => {
        const clock = makeClock();

        // Read in order and compare the later against the earlier. Inlining
        // both calls into one assertion reverses them — the expected value is
        // evaluated last — so a real clock ticking between the two reads failed
        // a property it actually holds.
        const first = clock.now().getTime();
        const second = clock.now().getTime();

        expect(second).toBeGreaterThanOrEqual(first);
      },
    },
  ]);
}
