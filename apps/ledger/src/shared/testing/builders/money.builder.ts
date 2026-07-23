import { Currency, Money } from '@ledger/shared/domain/money';

/**
 * Readable Money fixtures for domain tests: `aMoney().of('100').inUsd()`
 * states the amount first and the currency second.
 */
export function aMoney() {
  return {
    of(amount: string) {
      return {
        inUsd: () => Money.of(amount, Currency.of('USD', 2)),
        inCop: () => Money.of(amount, Currency.of('COP', 0)),
      };
    },
  };
}
