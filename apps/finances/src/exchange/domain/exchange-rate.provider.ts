/**
 * Provides the conversion rate between two currencies at a given date. The
 * source is the `exchanges` microservice (to be re-enabled). Carry-forward
 * policy: if there is no exact rate for the date, the closest earlier one is
 * used (AC-2).
 */
export abstract class ExchangeRateProvider {
  /** Rate to convert an amount from `from` to `to` on `date`. */
  abstract getRate(from: string, to: string, date: Date): Promise<number>;
}
