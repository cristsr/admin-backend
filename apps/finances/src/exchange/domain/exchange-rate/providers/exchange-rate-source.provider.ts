import { Nullable } from '@shared';

/**
 * Port for the external origin of rates (e.g. a market data site). Returns the
 * bare rate for a pair at a date, or `null` when the source has no usable value.
 */
export abstract class ExchangeRateSource {
  abstract fetchRate(from: string, to: string, date: Date): Promise<Nullable<number>>;
}
