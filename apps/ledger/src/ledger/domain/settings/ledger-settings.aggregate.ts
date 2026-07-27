import { AggregateRoot } from '@cqrs/domain/aggregate/aggregate-root';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { PresentationCurrencyChanged, TimezoneChanged } from '../../../settings/domain/ledger-settings/events';
import { CurrencyCode } from '../../../settings/domain/ledger-settings/value-objects';
import { IanaTimeZone } from '../../../settings/domain/ledger-settings/value-objects';
import { LedgerInitialized } from './events/ledger-initialized.event';

/** Arguments to initialize a user's ledger. */
export type InitializeLedgerArgs = {
  readonly userId: string;
  readonly presentationCurrency: string;
  readonly timezone: string;
  readonly openingBalancesAccountId: string;
  readonly adjustmentsAccountId: string;
};

/**
 * Per-user ledger settings aggregate (§3.3), streamed under the user id.
 * Presentation currency and timezone are recorded at initialization; the
 * technical account ids link the ledger to its system accounts (INV-13).
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

  /**
   * Change the presentation currency. No-op if the currency is already set to this value (idempotent).
   * @param currency The new currency code
   */
  changePresentationCurrency(currency: CurrencyCode): void {
    const newValue = currency.toString();
    if (this.presentationCurrency === newValue) {
      return; // idempotent: no-op if unchanged
    }

    this.raise(
      new PresentationCurrencyChanged(this.id, newValue),
    );
  }

  /**
   * Change the timezone. No-op if the timezone is already set to this value (idempotent).
   * @param timezone The new IANA timezone
   */
  changeTimezone(timezone: IanaTimeZone): void {
    const newValue = timezone.toString();
    if (this.timezone === newValue) {
      return; // idempotent: no-op if unchanged
    }

    this.raise(
      new TimezoneChanged(this.id, newValue),
    );
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
