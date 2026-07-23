import { LedgerDate } from './ledger-date';
import { InvalidLedgerDateException } from './value-object.exception';

describe('LedgerDate', () => {
  it('accepts a valid YYYY-MM-DD literal', () => {
    expect(LedgerDate.of('2026-07-22').value).toBe('2026-07-22');
  });

  it('rejects malformed or impossible dates', () => {
    expect(() => LedgerDate.of('2026-7-2')).toThrow(InvalidLedgerDateException);
    expect(() => LedgerDate.of('2026-13-01')).toThrow(InvalidLedgerDateException);
    expect(() => LedgerDate.of('2026-02-30')).toThrow(InvalidLedgerDateException);
    expect(() => LedgerDate.of('not-a-date')).toThrow(InvalidLedgerDateException);
  });

  it('orders chronologically', () => {
    const earlier = LedgerDate.of('2026-01-01');
    const later = LedgerDate.of('2026-12-31');

    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isAfter(earlier)).toBe(true);
    expect(earlier.isSameOrBefore(LedgerDate.of('2026-01-01'))).toBe(true);
  });

  it('compares by value', () => {
    expect(LedgerDate.of('2026-01-01').equals(LedgerDate.of('2026-01-01'))).toBe(true);
  });
});
