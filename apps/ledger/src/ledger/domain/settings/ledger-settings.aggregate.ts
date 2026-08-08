import { AggregateRoot } from '@cqrs/domain/aggregate/aggregate-root';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { CurrencyCode, IanaTimeZone } from '@ledger/shared/domain/value-objects';
import {
  LedgerInitialized,
  PresentationCurrencyChanged,
  TimezoneChanged,
} from './events';

/** Arguments to initialize a user's ledger. */
export type InitializeLedgerArgs = {
  readonly userId: string;
  readonly presentationCurrency: string;
  readonly timezone: string;
  readonly openingBalancesAccountId: string;
  readonly adjustmentsAccountId: string;
};

/**
 * Per-user ledger settings, streamed under the user id. Presentation currency
 * and time zone are recorded at initialization; the technical account ids link
 * the ledger to its system accounts (INV-13).
 */
export class LedgerSettings extends AggregateRoot<string> {
  private initialized = false;
  private presentationCurrency = '';
  private timezone = '';

  /** Creates the ledger, emitting {@link LedgerInitialized}. */
  static initialize(args: InitializeLedgerArgs): LedgerSettings {
    const settings = new LedgerSettings(args.userId);
    settings.raise(
      new LedgerInitialized({
        presentationCurrency: args.presentationCurrency,
        timezone: args.timezone,
        openingBalancesAccountId: args.openingBalancesAccountId,
        adjustmentsAccountId: args.adjustmentsAccountId,
      }),
    );

    return settings;
  }

  static rehydrate(id: string, events: readonly DomainEvent[]): LedgerSettings {
    const settings = new LedgerSettings(id);
    settings.loadFromHistory(events);

    return settings;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Silent when the currency already holds this value, so replays append nothing. */
  changePresentationCurrency(currency: CurrencyCode): void {
    if (this.presentationCurrency === currency.value) {
      return;
    }

    this.raise(new PresentationCurrencyChanged(this.id, currency.value));
  }

  /** Silent when the time zone already holds this value, so replays append nothing. */
  changeTimezone(timezone: IanaTimeZone): void {
    if (this.timezone === timezone.value) {
      return;
    }

    this.raise(new TimezoneChanged(this.id, timezone.value));
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof LedgerInitialized) {
      this.initialized = true;
      this.presentationCurrency = event.props.presentationCurrency;
      this.timezone = event.props.timezone;
    } else if (event instanceof PresentationCurrencyChanged) {
      this.presentationCurrency = event.presentationCurrency;
    } else if (event instanceof TimezoneChanged) {
      this.timezone = event.timezone;
    }
  }
}
