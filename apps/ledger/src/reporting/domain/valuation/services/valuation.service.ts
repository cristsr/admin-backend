import { Injectable } from '@nestjs/common';
import Big from 'big.js';

/**
 * Valuation service: converts account balances to net worth in presentation currency.
 * Uses end-of-day FX rates; falls back to 1.0 if no rate found.
 */
@Injectable()
export class ValuationService {
  /**
   * Convert an amount from its native currency to presentation currency.
   * priceResolver should return rate as string or null if not found.
   */
  async convertAmount(
    amount: string,
    fromCurrency: string,
    toCurrency: string,
    date: string,
    priceResolver: (base: string, quote: string, date: string) => Promise<string | null>,
  ): Promise<string> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = await priceResolver(fromCurrency, toCurrency, date);
    if (!rate) {
      // Default to 1.0 if no rate found (development phase)
      return amount;
    }

    return new Big(amount).times(new Big(rate)).toFixed(2);
  }

  /**
   * Half-even rounding (banker's rounding) to 2 decimal places.
   */
  roundHalfEven(value: string): string {
    return new Big(value).round(2, Big.roundHalfEven).toFixed(2);
  }
}
