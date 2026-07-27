import { AssertionLookupPort } from '@ledger/reconciliation/domain/ports/assertion-lookup.port';
import { AssertionPostingReader } from '@ledger/reconciliation/domain/ports/assertion-posting-reader.port';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { EvaluateAssertionCommand } from '../commands/evaluate-assertion.command';
import { EvaluateAssertionHandler } from '../commands/evaluate-assertion.handler';

/**
 * Events that can change an assertion's verdict.
 *
 * `TransactionRecorded` and `TransactionAmended` carry postings and date in
 * their payload. `TransactionVoided` carries only a reason, so its accounts are
 * resolved by reading `proj_postings` instead.
 *
 * `TransactionConfirmed` and `TransactionReversed` are deliberately absent:
 * confirming leaves the amount untouched (the posting already counted while
 * `PENDING`, and the evaluator sums `CONFIRMED`+`PENDING` alike), and a reversal
 * emits its own `TransactionRecorded` — with postings — which this reactor
 * already handles. See the tests that pin both.
 */
const REEVALUATION_TRIGGERS: ReadonlySet<string> = new Set([
  'TransactionRecorded',
  'TransactionAmended',
  'TransactionVoided',
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
export class ReevaluateAssertionsReactor {
  constructor(
    private readonly affectedAssertions: AssertionLookupPort,
    private readonly evaluate: EvaluateAssertionHandler,
    private readonly postings: AssertionPostingReader,
  ) {}

  async on(event: StoredEvent): Promise<void> {
    if (!REEVALUATION_TRIGGERS.has(event.eventType)) return; // guard: not a trigger

    const ctx: AuthContext = {
      userId: event.userId,
      clientId: event.clientId,
      externalRef: null,
    };

    for (const scope of await this.touchedAccounts(event)) {
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

  /**
   * Accounts the event moved. Events that carry their postings are read
   * straight from the payload; the ones that don't (`TransactionVoided`) are
   * resolved against `proj_postings`, which is written synchronously in the
   * command transaction (§8.1) and therefore already current by the time the
   * pump reaches the event.
   */
  private async touchedAccounts(event: StoredEvent): Promise<readonly TouchedAccount[]> {
    const payload = event.payload as Record<string, unknown>;
    const postings = (payload.postings as EventPosting[]) ?? [];

    if (!postings.length) return this.touchedByLookup(event);

    const affectedFrom = LedgerDate.of(payload.date as string);
    const accountIds = new Set(postings.map((posting) => posting.accountId));

    return [...accountIds].map((accountId) => ({ accountId, affectedFrom }));
  }

  private async touchedByLookup(event: StoredEvent): Promise<readonly TouchedAccount[]> {
    const touched = await this.postings.touchedByTransaction(event.userId, event.aggregateId);

    return touched.map((entry) => ({ accountId: entry.accountId, affectedFrom: entry.date }));
  }
}
