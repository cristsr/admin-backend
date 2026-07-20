import { DomainUnprocessableException } from '@shared';

/**
 * An amount or a currency that cannot represent money: a non-finite amount, a
 * blank currency, or a non-positive exchange rate. Maps to 422.
 */
export class InvalidMoneyException extends DomainUnprocessableException {}

/**
 * Two amounts in different currencies were combined. Adding COP to USD has no
 * meaning until one of them is converted, so the operation is refused instead
 * of producing a number nobody can interpret. Maps to 422.
 */
export class CurrencyMismatchException extends DomainUnprocessableException {}
