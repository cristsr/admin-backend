import { AggregateRoot } from '@ledger/shared-kernel/domain/aggregate/aggregate-root';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
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

  protected apply(event: DomainEvent): void {
    if (event instanceof LedgerInitialized) this.initialized = true;
  }
}
