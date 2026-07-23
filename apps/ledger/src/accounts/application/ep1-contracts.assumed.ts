// ASSUMED EP-1 CONTRACTS — replace at integration.
//
// Account-side commands and queries owned by EP-1. EP-2 constructs and dispatches
// these; it never reads their handlers. At integration, delete this file and
// import the real commands/queries from `@ledger/accounts/application`.
import { Nullable, PropertiesOnly } from '@shared';
import { LedgerCommand, LedgerQuery } from '@ledger/shared/application/ep1-contracts.assumed';
import { AccountType } from '@ledger/shared/domain/ep1-contracts.assumed';

/** Creates the technical system accounts and fixes presentation currency + timezone (§7.5). */
export class InitializeLedgerCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly presentationCurrency!: string;
  readonly timezone!: string;

  constructor(props: PropertiesOnly<InitializeLedgerCommand>) {
    Object.assign(this, props);
  }
}

/** Opens a chart-of-accounts node (§7 OpenAccount). */
export class OpenAccountCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly type!: AccountType;
  readonly name!: string;
  readonly parentId!: Nullable<string>;
  readonly currencies!: readonly string[];
  readonly openedOn!: string;
  readonly isBankMirror!: boolean;

  constructor(props: PropertiesOnly<OpenAccountCommand>) {
    Object.assign(this, props);
  }
}

/** Renames an account and, by consistency, its descendants' prefix (§2.1.1). */
export class RenameAccountCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly accountId!: string;
  readonly newName!: string;

  constructor(props: PropertiesOnly<RenameAccountCommand>) {
    Object.assign(this, props);
  }
}

/** Closes an account as of an accounting date (§7 CloseAccount). */
export class CloseAccountCommand implements LedgerCommand {
  readonly userId!: string;
  readonly clientId!: string;
  readonly externalRef!: Nullable<string>;
  readonly accountId!: string;
  readonly closedOn!: string;

  constructor(props: PropertiesOnly<CloseAccountCommand>) {
    Object.assign(this, props);
  }
}

/** How the `account_tree` projection is shaped in the response. */
export enum AccountTreeView {
  TREE = 'tree',
  FLAT = 'flat',
}

/** Reads the `account_tree` projection for the user (§7). */
export class AccountTreeQuery implements LedgerQuery {
  readonly userId!: string;
  readonly view!: AccountTreeView;

  constructor(props: PropertiesOnly<AccountTreeQuery>) {
    Object.assign(this, props);
  }
}

/** Reads a single account node from the `account_tree` projection. */
export class AccountByIdQuery implements LedgerQuery {
  readonly userId!: string;
  readonly accountId!: string;

  constructor(props: PropertiesOnly<AccountByIdQuery>) {
    Object.assign(this, props);
  }
}

/** Reads the `account_balances` projection (confirmed/pending per currency, INV-5). */
export class AccountBalancesQuery implements LedgerQuery {
  readonly userId!: string;
  readonly accountId!: string;
  readonly currency!: Nullable<string>;

  constructor(props: PropertiesOnly<AccountBalancesQuery>) {
    Object.assign(this, props);
  }
}

/** Reads the `proj_ledger_settings` projection (presentation currency, timezone). */
export class LedgerSettingsQuery implements LedgerQuery {
  readonly userId!: string;

  constructor(props: PropertiesOnly<LedgerSettingsQuery>) {
    Object.assign(this, props);
  }
}
