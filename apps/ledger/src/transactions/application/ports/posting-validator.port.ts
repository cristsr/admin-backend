import { AccountType, LedgerDate, PostingOrigin } from '@ledger/shared/domain/value-objects';
import { PostingLine } from '@ledger/shared/domain/posting/posting-line';

/**
 * Validates a transaction's postings against the accounts they touch, and
 * answers the account type behind each one.
 *
 * The rules it enforces (INV-3 open-on-date, INV-4 allowed currency, INV-13
 * system accounts reachable only from a system origin) belong to the `accounts`
 * context, which owns the account tree. This port is how `transactions` states
 * what it needs without depending on how `accounts` provides it — the
 * anti-corruption layer between the two: the adapter is the only file here that
 * knows the other module exists.
 *
 * Returning the touched types is not incidental: the caller derives the
 * transaction kind from them, and re-reading the tree to do so would be a
 * second query over state that was just validated.
 */
export abstract class PostingValidator {
  abstract validate(
    userId: string,
    date: LedgerDate,
    postings: readonly PostingLine[],
    origin: PostingOrigin,
  ): Promise<readonly AccountType[]>;
}
