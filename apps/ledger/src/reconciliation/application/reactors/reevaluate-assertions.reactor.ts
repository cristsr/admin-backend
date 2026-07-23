import { Injectable } from '@nestjs/common';
import { AssertionLookupPort } from '@ledger/reconciliation/domain/ports/assertion-lookup.port';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { EvaluateAssertionCommand } from '../commands/evaluate-assertion.command';
import { EvaluateAssertionHandler } from '../commands/evaluate-assertion.handler';

/**
 * Events whose payload carries the postings (and date) needed to know which
 * accounts moved. Real EP-1 status events (`TransactionConfirmed`/`Voided`/
 * `Reversed`) omit postings; re-evaluating on those would need a transaction
 * lookup — TODO(reactor): balance-decreasing voids are not yet re-evaluated.
 */
const REEVALUATION_TRIGGERS: ReadonlySet<string> = new Set([
  'TransactionRecorded',
  'TransactionAmended',
]);

/** An account touched by an event and the earliest altered date on it. */
interface TouchedAccount {
  readonly accountId: string;
  readonly affectedFrom: LedgerDate;
}

/** The posting shape carried inside a transaction event payload. */
interface EventPosting {
  readonly accountId: string;
}

/**
 * Process manager (RF-18): on a posting-altering event, finds the user's
 * non-revoked assertions on the touched accounts whose cutoff is at or after the
 * transaction date, and runs `EvaluateAssertion` for each. It never writes events
 * or projections itself (§3.2, RNF-10). Reprocessing is safe: `EvaluateAssertion`
 * is idempotent and the aggregate stays silent on an unchanged verdict.
 */
@Injectable()
export class ReevaluateAssertionsReactor {
  constructor(
    private readonly affectedAssertions: AssertionLookupPort,
    private readonly evaluate: EvaluateAssertionHandler,
  ) {}

  async on(event: StoredEvent): Promise<void> {
    if (!REEVALUATION_TRIGGERS.has(event.eventType)) return; // guard: not a trigger

    const ctx: AuthContext = {
      userId: event.userId,
      clientId: event.clientId,
      externalRef: null,
    };

    for (const scope of this.touchedAccounts(event)) {
      const assertionIds = await this.affectedAssertions.onAccountFrom(
        event.userId,
        scope.accountId,
        scope.affectedFrom,
      );

      for (const assertionId of assertionIds) {
        await this.evaluate.execute(new EvaluateAssertionCommand(assertionId), ctx);
      }
    }
  }

  private touchedAccounts(event: StoredEvent): readonly TouchedAccount[] {
    const payload = event.payload as Record<string, unknown>;
    const postings = (payload.postings as EventPosting[]) ?? [];

    if (!postings.length) return []; // guard: nothing to re-evaluate

    const affectedFrom = LedgerDate.of(payload.date as string);
    const accountIds = new Set(postings.map((posting) => posting.accountId));

    return [...accountIds].map((accountId) => ({ accountId, affectedFrom }));
  }
}
