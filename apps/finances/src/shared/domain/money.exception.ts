import { DomainUnprocessableException } from '@shared';

export class InvalidMoneyException extends DomainUnprocessableException {}

export class CurrencyMismatchException extends DomainUnprocessableException {}
