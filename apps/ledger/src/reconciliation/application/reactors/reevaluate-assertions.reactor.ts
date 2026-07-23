import { Injectable } from '@nestjs/common';
import { AssertionLookupPort } from '@ledger/reconciliation/domain/ports/assertion-lookup.port';
import {
  CommandBus,
  DomainEvent,
  LocalDate,
  TRANSACTION_AMENDED,
  TRANSACTION_CONFIRMED,
  TRANSACTION_RECORDED,
  TRANSACTION_REVERSED,
  TRANSACTION_VOIDED,
  TRANSFERS_MERGED,
  TransactionEventPayload,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { EvaluateAssertionCommand } from '../commands/evaluate-assertion.command';

/** Events whose postings can shift an account balance and warrant re-evaluation. */
const REEVALUATION_TRIGGERS: ReadonlySet<string> = new Set([
  TRANSACTION_RECORDED,
  TRANSACTION_CONFIRMED,
  TRANSACTION_AMENDED,
  TRANSACTION_VOIDED,
  TRANSACTION_REVERSED,
  TRANSFERS_MERGED,
]);

/** An account touched by an event and the earliest altered date on it. */
interface TouchedAccount {
  readonly accountId: string;
  readonly affectedFrom: LocalDate;
}

/**
 * Process manager (RF-18): on a posting-altering event, finds the user's
 * non-revoked assertions on the touched accounts whose cutoff is at or after the
 * earliest altered date, and dispatches `EvaluateAssertion` for each. Dispatch
 * only — it never writes events or projections (§3.2, RNF-10). Reprocessing is
 * safe: `EvaluateAssertion` is idempotent and the aggregate stays silent on an
 * unchanged verdict.
 */
@Injectable()
export class ReevaluateAssertionsReactor {
  constructor(
    private readonly affectedAssertions: AssertionLookupPort,
    private readonly commandBus: CommandBus,
  ) {}

  async on(event: DomainEvent): Promise<void> {
    if (!REEVALUATION_TRIGGERS.has(event.type)) return; // guard: not a trigger

    for (const scope of this.touchedAccounts(event)) {
      const assertionIds = await this.affectedAssertions.onAccountFrom(
        event.userId,
        scope.accountId,
        scope.affectedFrom,
      );

      for (const assertionId of assertionIds) {
        await this.commandBus.execute(new EvaluateAssertionCommand(event.context, assertionId));
      }
    }
  }

  private touchedAccounts(event: DomainEvent): readonly TouchedAccount[] {
    const payload = event.payload as TransactionEventPayload;

    if (!payload?.postings?.length) return []; // guard: nothing to re-evaluate

    const earliestByAccount = new Map<string, LocalDate>();

    for (const posting of payload.postings) {
      const date = LocalDate.of(posting.date);
      const current = earliestByAccount.get(posting.accountId);

      if (!current || date.isBefore(current)) earliestByAccount.set(posting.accountId, date);
    }

    return [...earliestByAccount].map(([accountId, affectedFrom]) => ({ accountId, affectedFrom }));
  }
}
