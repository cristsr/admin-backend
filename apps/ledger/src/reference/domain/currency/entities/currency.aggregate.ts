import { AggregateRoot } from '../../../shared-kernel/domain/aggregate/aggregate-root';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';

export class CurrencyRegistered extends DomainEvent {
  readonly eventType = 'CurrencyRegistered';
  readonly schemaVersion = 1;

  constructor(
    readonly code: string,
    readonly minorUnits: number,
    readonly name: string,
  ) {
    super();
  }

  toPayload() {
    return { code: this.code, minorUnits: this.minorUnits, name: this.name };
  }
}

/**
 * Thin aggregate: currency registration is append-only via CurrencyRegistered events.
 */
export class Currency extends AggregateRoot<string> {
  private minorUnits: number = 0;
  private name: string = '';

  static register(code: string, minorUnits: number, name: string): Currency {
    const currency = new Currency(code);
    currency.raise(new CurrencyRegistered(code, minorUnits, name));
    return currency;
  }

  static rehydrate(code: string, events: readonly DomainEvent[]): Currency {
    const currency = new Currency(code);
    currency.loadFromHistory(events);
    return currency;
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof CurrencyRegistered) {
      this.minorUnits = event.minorUnits;
      this.name = event.name;
    }
  }
}
