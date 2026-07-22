import { PropertiesOnly } from '@shared';

/** A conversion rate between two currencies observed at a given date. */
export class ExchangeRate {
  id: number;

  from: string;

  to: string;

  rate: number;

  date: Date;

  private constructor(payload?: Partial<ExchangeRate>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<ExchangeRate>): ExchangeRate {
    return new ExchangeRate(payload);
  }
}
