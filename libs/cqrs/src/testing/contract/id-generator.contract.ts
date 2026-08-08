import { IdGenerator } from '@cqrs/domain/ports';
import { defineContract } from './define-contract';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UNIQUENESS_SAMPLE = 1_000;

/**
 * The reusable contract for any IdGenerator. Each adapter's spec invokes this
 * runner so the deterministic double and the real adapter prove identical
 * behaviour.
 */
export function runIdGeneratorContract(makeIdGenerator: () => IdGenerator): void {
  defineContract('IdGenerator contract', [
    {
      name: 'returns UUID-shaped strings',
      verify: () => {
        expect(makeIdGenerator().next()).toMatch(UUID_V4);
      },
    },
    {
      name: `never repeats an id across ${UNIQUENESS_SAMPLE} calls`,
      verify: () => {
        const generator = makeIdGenerator();
        const ids = new Set(Array.from({ length: UNIQUENESS_SAMPLE }, () => generator.next()));

        expect(ids.size).toBe(UNIQUENESS_SAMPLE);
      },
    },
  ]);
}
