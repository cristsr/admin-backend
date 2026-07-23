// ASSUMED EP-1/EP-2 CONTRACTS — replace at integration
//
// EP-3 is implemented in an isolated worktree where EP-1 (domain core, event
// store, buses, projections) and EP-2 (HTTP surface) do not yet exist. This
// file declares the *minimum* contracts EP-3 consumes so the module compiles
// and its tests run autonomously. Everything here is a stand-in for real EP-1/
// EP-2 artifacts and MUST be deleted (imports repointed) when the epics merge.
//
// Fidelity notes for the integrator:
//  - `DomainEvent`, `AuthenticatedContext`, `LocalDate` and `PostingLine` are
//    given *working* implementations because EP-3 tests exercise their
//    behaviour. The real EP-1 versions should be drop-in compatible in shape.
//  - Buses, repositories and read-side ports are declared as `abstract class`
//    tokens only; EP-3 depends on the abstraction, never on an implementation.
//  - Transaction command classes are plain data holders: EP-3 (ResolveDiscrepancy,
//    MergePendingTransfers) reuses them through the `CommandBus` rather than
//    reimplementing the LedgerTransaction lifecycle (DRY, spec §3.3/§6.3).

import { Nullable } from '@shared';
import { Currency, Money } from '@ledger/shared/domain/money';

/**
 * Seed currency precisions (roadmap: `{COP:0, USD:2}`). Stands in for the EP-1.1
 * / EP-4.2 currency registry. Used to rebuild `Money` from the currency codes
 * carried in event payloads during event-sourced replay.
 */
const SEED_MINOR_UNITS: Readonly<Record<string, number>> = { COP: 0, USD: 2 };

/** Resolves a `Currency` from its code against the assumed seed registry. */
export function resolveAssumedCurrency(code: string): Currency {
  const normalized = code?.trim().toUpperCase() ?? '';
  const minorUnits = SEED_MINOR_UNITS[normalized];

  if (minorUnits === undefined) {
    throw new AssumedContractException(`Unknown currency "${code}" in the assumed seed registry`);
  }

  return Currency.of(normalized, minorUnits);
}

/**
 * Plain accounting date `YYYY-MM-DD`, timezone-free (RNF-7, roadmap
 * "LedgerDate = YYYY-MM-DD"). Assumed EP-1 value object; given real behaviour
 * because the assertion evaluator compares and orders dates.
 */
export class LocalDate {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {}

  static of(iso: string): LocalDate {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() ?? '');

    if (!match) {
      throw new AssumedContractException(`"${iso}" is not a valid YYYY-MM-DD date`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new AssumedContractException(`"${iso}" is not a real calendar date`);
    }

    return new LocalDate(year, month, day);
  }

  /** Comparable ordinal: strictly monotonic in calendar order. */
  private get ordinal(): number {
    return this.year * 10000 + this.month * 100 + this.day;
  }

  isBefore(other: LocalDate): boolean {
    return this.ordinal < other.ordinal;
  }

  isAfter(other: LocalDate): boolean {
    return this.ordinal > other.ordinal;
  }

  equals(other: LocalDate): boolean {
    return this.ordinal === other.ordinal;
  }

  isOnOrBefore(other: LocalDate): boolean {
    return this.ordinal <= other.ordinal;
  }

  isOnOrAfter(other: LocalDate): boolean {
    return this.ordinal >= other.ordinal;
  }

  toString(): string {
    const mm = String(this.month).padStart(2, '0');
    const dd = String(this.day).padStart(2, '0');

    return `${this.year}-${mm}-${dd}`;
  }
}

/**
 * Authenticated write context resolved by the external identity service (RF-26).
 * Carried on every command and event for auditing; opaque to the ledger.
 */
export class AuthenticatedContext {
  constructor(
    readonly userId: string,
    readonly clientId: string,
  ) {}
}

/** Lifecycle status of a transaction; enum-in-app, stored as text (no DB enums). */
export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  VOIDED = 'VOIDED',
}

/** Stable domain-event type names EP-3 reacts to / projects. */
export const TRANSACTION_RECORDED = 'TransactionRecorded';
export const TRANSACTION_CONFIRMED = 'TransactionConfirmed';
export const TRANSACTION_AMENDED = 'TransactionAmended';
export const TRANSACTION_VOIDED = 'TransactionVoided';
export const TRANSACTION_REVERSED = 'TransactionReversed';
export const TRANSFERS_MERGED = 'TransfersMerged';

/**
 * A posting as it appears inside a transaction event payload, materialized the
 * same way EP-1 projects `proj_postings`. Amounts are decimal strings (RNF-2).
 */
export interface PostingSnapshot {
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
  readonly date: string;
  readonly occurredAt: Nullable<string>;
  readonly status: TransactionStatus;
}

/** Shared shape of the transaction events whose postings can shift a balance. */
export interface TransactionEventPayload {
  readonly transactionId: string;
  readonly postings: readonly PostingSnapshot[];
}

/**
 * Domain-event envelope (spec §3.4). Assumed EP-1 type given a working shape:
 * EP-3's aggregate emits these, and its reactor/projectors read them.
 */
export class DomainEvent<TPayload = unknown> {
  constructor(
    readonly type: string,
    readonly aggregateId: string,
    readonly aggregateType: string,
    readonly sequence: number,
    readonly userId: string,
    readonly clientId: string,
    readonly externalRef: Nullable<string>,
    readonly occurredAt: Date,
    readonly payload: TPayload,
    readonly eventId: Nullable<string> = null,
    readonly recordedAt: Nullable<Date> = null,
  ) {}

  /** Rebuilds the authenticated context from the envelope for command dispatch. */
  get context(): AuthenticatedContext {
    return new AuthenticatedContext(this.userId, this.clientId);
  }
}

/** Result of a write command: generated ids and the reached stream position (RNF-9). */
export interface CommandResult {
  readonly aggregateId: string;
  readonly streamPosition: number;
}

/** An event tagged with its global stream position, as returned by `readAll`. */
export interface PositionedEvent {
  readonly position: number;
  readonly event: DomainEvent;
}

/**
 * Append-only event store (assumed EP-1, spec §3.8). EP-3's repositories and the
 * e2e wiring depend on this abstraction; the real Postgres adapter lands in EP-1.
 */
export abstract class EventStore {
  /**
   * Appends events under optimistic concurrency; on a duplicate anchor
   * `external_ref` returns the original result (idempotency, INV-10).
   */
  abstract append(
    aggregateId: string,
    expectedVersion: number,
    events: readonly DomainEvent[],
  ): Promise<CommandResult>;

  /** All events of an aggregate in sequence order (empty when it does not exist). */
  abstract load(aggregateId: string): Promise<readonly DomainEvent[]>;

  /** The global stream from a position (exclusive), ordered by position. */
  abstract readAll(fromPosition: number): Promise<readonly PositionedEvent[]>;
}

/** Raised on an optimistic-concurrency version conflict (assumed EP-1). */
export class LedgerConcurrencyException extends Error {
  readonly code = 'CONCURRENCY_CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'LedgerConcurrencyException';
  }
}

/**
 * Write-side dispatcher. Assumed EP-1 bus (idempotency by `external_ref`,
 * authenticated context, optimistic concurrency applied as cross-cutting
 * policies). EP-3 depends only on this abstraction.
 */
export abstract class CommandBus {
  abstract execute<TResult extends CommandResult = CommandResult>(command: object): Promise<TResult>;
}

/** Read-side dispatcher (assumed EP-1). */
export abstract class QueryBus {
  abstract execute<TResult>(query: object): Promise<TResult>;
}

/**
 * Reads the user's ledger settings from `proj_ledger_settings` (assumed EP-4/EP-1
 * read model). EP-3.2 needs the IANA timezone to resolve day boundaries.
 */
export abstract class LedgerSettingsReader {
  abstract timezoneOf(userId: string): Promise<string>;
}

/** Resolves the id of a user's technical account by canonical name (INV-13). */
export abstract class SystemAccountLookup {
  /** The user's `Equity:Adjustments` account id, created at InitializeLedger. */
  abstract adjustmentsAccountId(userId: string): Promise<string>;
}

/** Minimal account facts EP-3.7 needs from `proj_accounts` for transfer detection. */
export interface AccountFacts {
  readonly accountId: string;
  readonly type: string;
  readonly currency: Nullable<string>;
  readonly isBankMirror: boolean;
}

/** Reads account facts (type, currency, mirror flag) from `proj_accounts`. */
export abstract class AccountLookup {
  abstract factsOf(userId: string, accountId: string): Promise<Nullable<AccountFacts>>;
}

/**
 * Records a new transaction (PENDING or directly CONFIRMED). Assumed EP-1
 * command; reused by ResolveDiscrepancy (adjustment) and MergePendingTransfers.
 */
export class RecordTransactionCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly transactionId: string,
    readonly date: string,
    readonly description: string,
    readonly postings: readonly PostingLineInput[],
    readonly metadata: Readonly<Record<string, unknown>> = {},
  ) {}
}

/** Confirms a pending transaction, freezing its postings. Assumed EP-1 command. */
export class ConfirmTransactionCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly transactionId: string,
  ) {}
}

/** Voids a pending transaction. Assumed EP-1 command. */
export class VoidPendingTransactionCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly transactionId: string,
    readonly reason: string,
  ) {}
}

/** Serializable posting input carried by RecordTransactionCommand. */
export interface PostingLineInput {
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A single account/amount line of a transaction (assumed EP-1 value object).
 * Given real behaviour so EP-3.5's AdjustmentFactory can build balanced pairs.
 */
export class PostingLine {
  constructor(
    readonly accountId: string,
    readonly amount: Money,
  ) {}

  toInput(): PostingLineInput {
    return {
      accountId: this.accountId,
      amount: this.amount.toDecimalString(),
      currency: this.amount.currency.code,
    };
  }
}

/** Local failure raised by the assumed contracts; real EP-1 has its own hierarchy. */
export class AssumedContractException extends Error {
  readonly code = 'ASSUMED_CONTRACT_VIOLATION';

  constructor(message: string) {
    super(message);
    this.name = 'AssumedContractException';
  }
}
