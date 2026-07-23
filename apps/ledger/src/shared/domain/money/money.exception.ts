import { DomainUnprocessableException } from '@shared';

/** The amount literal is not a valid decimal string — or a `number` slipped in (INV-8). */
export class InvalidMoneyException extends DomainUnprocessableException {}

/** Two monies were combined without sharing a currency. */
export class CurrencyMismatchException extends DomainUnprocessableException {}

/** The amount's scale exceeds the currency's minor units (spec §2.7.1). */
export class MoneyScaleException extends DomainUnprocessableException {}

/** The currency code is blank or its minor units are not a non-negative integer. */
export class InvalidCurrencyException extends DomainUnprocessableException {}
