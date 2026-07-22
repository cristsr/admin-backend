/**
 * Port other modules depend on to convert between currencies. Resolves the rate
 * for a pair at a date, falling back to the closest earlier observation.
 */
export abstract class ExchangeRateProvider {
  abstract getRate(from: string, to: string, date: Date): Promise<number>;
}
