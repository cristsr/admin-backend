import { AggregateRoot } from '@cqrs/domain/aggregate/aggregate-root';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { CURRENCY_REGISTERED, CurrencyRegistered } from './events/currency-registered.event';
import {
  CurrencyPrecisionConflictException,
  InvalidMinorUnitsException,
} from './exceptions/currency.exception';

/**
 * Fixed stream id of the reference catalog. The catalog is global — a currency's
 * precision is universal, not a per-user fact — so it lives in a single stream
 * rather than one per user.
 */
export const CURRENCY_CATALOG_ID = 'currency-catalog';

/** Widest precision ISO-4217 defines (CLF, UYW). COP is 0, USD is 2. */
const MAX_MINOR_UNITS = 4;

/**
 * The reference currency catalog (§3.3): a deliberately thin event-sourced
 * aggregate. It guards no accounting invariant — its whole job is that a code
 * maps to one precision, forever.
 */
export class CurrencyCatalogAggregate extends AggregateRoot<string> {
  private readonly precisions = new Map<string, number>();

  static rehydrate(events: readonly DomainEvent[]): CurrencyCatalogAggregate {
    const catalog = new CurrencyCatalogAggregate(CURRENCY_CATALOG_ID);
    catalog.loadFromHistory(events);

    return catalog;
  }

  /**
   * Registers a currency. Re-registering with the same precision is a silent
   * no-op (RNF-4); with a different one it is rejected — changing a currency's
   * precision would reinterpret every amount ever recorded in it, which is
   * exactly what design principle #5 forbids.
   */
  register(code: string, minorUnits: number, name: string): void {
    this.ensureValidPrecision(minorUnits);

    const existing = this.precisions.get(code);

    if (existing === minorUnits) return; // idempotent: identical registration

    if (existing !== undefined) {
      throw new CurrencyPrecisionConflictException(
        `Currency "${code}" is registered with ${existing} minor units; refusing to change it to ${minorUnits}`,
      );
    }

    this.raise(new CurrencyRegistered(code, minorUnits, name));
  }

  /** Precision of a registered currency, or undefined when unknown. */
  precisionOf(code: string): number | undefined {
    return this.precisions.get(code);
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof CurrencyRegistered) {
      this.precisions.set(event.code, event.minorUnits);
    }
  }

  private ensureValidPrecision(minorUnits: number): void {
    if (!Number.isInteger(minorUnits) || minorUnits < 0 || minorUnits > MAX_MINOR_UNITS) {
      throw new InvalidMinorUnitsException(
        `Minor units must be an integer between 0 and ${MAX_MINOR_UNITS}, received "${minorUnits}"`,
      );
    }
  }
}

export { CURRENCY_REGISTERED };
