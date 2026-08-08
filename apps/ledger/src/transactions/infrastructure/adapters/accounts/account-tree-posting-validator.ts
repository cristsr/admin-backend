import { AccountValidationService } from '@ledger/accounts/application/services/account-validation.service';
import { AccountType, LedgerDate, PostingOrigin } from '@ledger/shared/domain/value-objects';
import { PostingValidator } from '@ledger/transactions/application/ports/posting-validator.port';
import { PostingLine } from '@ledger/shared/domain/posting/posting-line';

/**
 * Anti-corruption adapter: satisfies this module's {@link PostingValidator} with
 * the `accounts` context's own validation against `account_tree`.
 *
 * This is the single file in `transactions` allowed to name
 * `AccountValidationService`. Keeping it here — rather than injecting that class
 * into the handlers — is what lets the collaboration change (a port on the
 * accounts side, an event, a cache) without touching a single use case.
 */
export class AccountTreePostingValidator extends PostingValidator {
  constructor(private readonly accounts: AccountValidationService) {
    super();
  }

  validate(
    userId: string,
    date: LedgerDate,
    postings: readonly PostingLine[],
    origin: PostingOrigin,
  ): Promise<readonly AccountType[]> {
    return this.accounts.validate(userId, date, postings, origin);
  }
}
