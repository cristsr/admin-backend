/** Conversion rate between two currencies at a date; falls back to the closest earlier rate. */
export abstract class ExchangeRateProvider {
  abstract getRate(from: string, to: string, date: Date): Promise<number>;
}
