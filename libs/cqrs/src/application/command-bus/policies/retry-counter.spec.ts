import { NoopRetryCounter } from './retry-counter';

describe('NoopRetryCounter', () => {
  it('accepts increments without throwing', () => {
    expect(() => new NoopRetryCounter().increment('RecordTransactionCommand')).not.toThrow();
  });
});
