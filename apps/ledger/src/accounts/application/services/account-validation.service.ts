import {
  AccountConstraints,
  AccountConstraintsReader,
} from '@ledger/accounts/application/ports/account-constraints-reader.port';
import {
  ensureAcceptsCurrency,
  ensureOpenOn,
} from '@ledger/accounts/domain/account/account-availability';
import {
  AccountNotFoundException,
  SystemAccountProtectedException,
} from '@ledger/accounts/domain/account/exceptions/account.exception';
import {
  AccountType,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared/domain/value-objects';
import { PostingOrigin } from '@ledger/shared/domain/value-objects/posting-origin';
import { PostingLine } from '@ledger/shared/domain/posting/posting-line';

/**
 * Cross-aggregate validation of postings against `account_tree`: each
 * referenced account must exist, be open on the transaction date (INV-3),
 * accept the posting currency (INV-4) and — the second half of INV-13 — be a
 * regular account unless the command comes from the ledger itself. Consistency
 * is relaxed — the tree is a projection — but a miss surfaces as a typed error,
 * never corruption.
 */
export class AccountValidationService {
  constructor(private readonly accounts: AccountConstraintsReader) {}

  /**
   * Validates every posting and returns the touched account types.
   * `origin` defaults to {@link PostingOrigin.CLIENT} so a caller that forgets
   * to state it is refused the technical accounts rather than granted them.
   */
  async validate(
    userId: string,
    date: LedgerDate,
    postings: readonly PostingLine[],
    origin: PostingOrigin = PostingOrigin.CLIENT,
  ): Promise<readonly AccountType[]> {
    const byId = await this.accounts.byIds(
      userId,
      postings.map((posting) => posting.accountId),
    );

    return postings.map((posting) => this.validatePosting(posting, date, byId, origin));
  }

  private validatePosting(
    posting: PostingLine,
    date: LedgerDate,
    byId: ReadonlyMap<string, AccountConstraints>,
    origin: PostingOrigin,
  ): AccountType {
    const account = byId.get(posting.accountId);

    if (!account) {
      throw new AccountNotFoundException(`Account "${posting.accountId}" does not exist`);
    }

    this.ensureReachableFrom(account, origin);
    // The rule itself lives in the domain, applied here to projected facts
    // instead of to a loaded aggregate: one implementation, two sources of state.
    ensureOpenOn(
      {
        openedOn: LedgerDate.of(account.openedOn),
        closedOn: account.closedOn ? LedgerDate.of(account.closedOn) : null,
      },
      date,
      account.name,
    );
    ensureAcceptsCurrency(
      // The projection states one currency, or null for an account that takes
      // any — which the domain models as an empty allow-list.
      account.currency ? [CurrencyCode.of(account.currency)] : [],
      CurrencyCode.of(posting.currencyCode),
      account.name,
    );

    return account.type as AccountType;
  }

  /**
   * INV-13: `Equity:OpeningBalances` and `Equity:Adjustments` "only receive
   * postings from transactions of system origin". Without this any
   * authenticated caller could book straight against them and manufacture
   * balance out of nothing.
   */
  private ensureReachableFrom(account: AccountConstraints, origin: PostingOrigin): void {
    if (!account.isSystem) return;

    if (origin === PostingOrigin.SYSTEM) return;

    throw new SystemAccountProtectedException(
      `Account "${account.accountId}" is a system account and only accepts system postings`,
    );
  }

}
