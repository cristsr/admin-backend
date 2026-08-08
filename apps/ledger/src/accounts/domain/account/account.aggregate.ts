import { AggregateRoot } from '@cqrs/domain/aggregate/aggregate-root';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { IdGenerator } from '@cqrs/domain/ports';
import { Nullable } from '@shared';
import {
  AccountName,
  AccountType,
  CurrencyCode,
  LedgerDate,
  REAL_ACCOUNT_TYPES,
  RootTypeImmutableException,
} from '@ledger/shared/domain/value-objects';
import { AccountClosed, AccountOpened, AccountRenamed } from './events';
import {
  AccountAlreadyClosedException,
  AccountClosedException,
  CurrencyNotAllowedException,
  InvalidCloseDateException,
  RealAccountCurrencyException,
  SystemAccountProtectedException,
} from './exceptions/account.exception';

/** Arguments to open an account; identity is minted by the aggregate. */
export type OpenAccountArgs = {
  readonly name: AccountName;
  readonly currencies: readonly CurrencyCode[];
  readonly openedOn: LedgerDate;
  readonly isBankMirror: boolean;
  readonly isSystem: boolean;
};

/**
 * Account lifecycle aggregate: opening, renaming and closing. Protects
 * INV-4 (allowed currencies), INV-13 (system accounts are immutable), INV-14
 * (root type never changes) and INV-3 partially (open-on-date range). The
 * cross-aggregate posting checks (INV-3/INV-4 against the tree) live in the
 * command handler; here the account guards only its own state.
 */
export class Account extends AggregateRoot<string> {
  private accountName!: AccountName;
  private accountType!: AccountType;
  private currencies: readonly CurrencyCode[] = [];
  private openedOn!: LedgerDate;
  private closedOn: Nullable<LedgerDate> = null;
  private system = false;

  /** Opens an account, enforcing the real-account single-currency rule. */
  static open(args: OpenAccountArgs, idGenerator: IdGenerator): Account {
    const rootType = args.name.rootType;

    if (REAL_ACCOUNT_TYPES.includes(rootType) && args.currencies.length !== 1) {
      throw new RealAccountCurrencyException(
        `Real account "${args.name.value}" must declare exactly one currency`,
      );
    }

    const account = new Account(idGenerator.next());
    account.raise(
      new AccountOpened({
        accountId: account.id,
        type: rootType,
        name: args.name.value,
        parentName: args.name.parentName()?.value ?? null,
        currencies: args.currencies.map((code) => code.value),
        openedOn: args.openedOn.value,
        isBankMirror: args.isBankMirror,
        isSystem: args.isSystem,
      }),
    );

    return account;
  }

  /** Rebuilds an account from its ordered history. */
  static rehydrate(id: string, events: readonly DomainEvent[]): Account {
    const account = new Account(id);
    account.loadFromHistory(events);

    return account;
  }

  get name(): AccountName {
    return this.accountName;
  }

  get type(): AccountType {
    return this.accountType;
  }

  get isSystem(): boolean {
    return this.system;
  }

  get isClosed(): boolean {
    return !!this.closedOn;
  }

  /** Renames the account; the root type is immutable and system accounts cannot be renamed. */
  rename(newName: AccountName): void {
    if (this.system) {
      throw new SystemAccountProtectedException(
        `System account "${this.accountName.value}" cannot be renamed`,
      );
    }

    if (newName.rootType !== this.accountType) {
      throw new RootTypeImmutableException(
        `Cannot re-root "${this.accountName.value}" to ${newName.rootType} (INV-14)`,
      );
    }

    this.raise(new AccountRenamed(this.accountName.value, newName.value));
  }

  /** Closes the account on a date; system accounts cannot be closed (INV-13). */
  close(closedOn: LedgerDate): void {
    if (this.system) {
      throw new SystemAccountProtectedException(
        `System account "${this.accountName.value}" cannot be closed`,
      );
    }

    if (this.closedOn) {
      throw new AccountAlreadyClosedException(
        `Account "${this.accountName.value}" is already closed`,
      );
    }

    if (closedOn.isBefore(this.openedOn)) {
      throw new InvalidCloseDateException('Close date cannot precede the open date');
    }

    this.raise(new AccountClosed(closedOn.value));
  }

  /** INV-3 (partial): the account must be open on the posting date. */
  ensureOpenOn(date: LedgerDate): void {
    if (date.isBefore(this.openedOn)) {
      throw new AccountClosedException(
        `Account "${this.accountName.value}" was not open on ${date.value}`,
      );
    }

    if (this.closedOn && date.isAfter(this.closedOn)) {
      throw new AccountClosedException(
        `Account "${this.accountName.value}" was closed on ${this.closedOn.value}`,
      );
    }
  }

  /** INV-4: the currency must be allowed. Empty allow-list means multi-currency. */
  ensureAcceptsCurrency(code: CurrencyCode): void {
    if (!this.currencies.length) return;

    if (!this.currencies.some((allowed) => allowed.equals(code))) {
      throw new CurrencyNotAllowedException(
        `Account "${this.accountName.value}" does not accept ${code.value}`,
      );
    }
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof AccountOpened) {
      this.accountName = AccountName.of(event.props.name);
      this.accountType = event.props.type;
      this.currencies = event.props.currencies.map((code) => CurrencyCode.of(code));
      this.openedOn = LedgerDate.of(event.props.openedOn);
      this.system = event.props.isSystem;

      return;
    }

    if (event instanceof AccountRenamed) {
      this.accountName = AccountName.of(event.newName);

      return;
    }

    if (event instanceof AccountClosed) {
      this.closedOn = LedgerDate.of(event.closedOn);
    }
  }
}
