import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/application/read-models/account-tree.read-model';
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
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';

/**
 * Cross-aggregate validation of postings against `account_tree`: each
 * referenced account must exist, be open on the transaction date (INV-3),
 * accept the posting currency (INV-4) and — the second half of INV-13 — be a
 * regular account unless the command comes from the ledger itself. Consistency
 * is relaxed — the tree is a projection — but a miss surfaces as a typed error,
 * never corruption.
 */
export class AccountValidationService {
  constructor(private readonly readModel: ReadModelStore) {}

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
    const accounts = await this.readModel.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId),
    );
    const byId = new Map(accounts.map((account) => [account.account_id, account]));

    return postings.map((posting) => this.validatePosting(posting, date, byId, origin));
  }

  private validatePosting(
    posting: PostingLine,
    date: LedgerDate,
    byId: Map<string, AccountRow>,
    origin: PostingOrigin,
  ): AccountType {
    const account = byId.get(posting.accountId);

    if (!account) {
      throw new AccountNotFoundException(`Account "${posting.accountId}" does not exist`);
    }

    this.ensureReachableFrom(account, origin);
    // The rule itself lives in the domain, applied here to a projection row
    // instead of to a loaded aggregate: one implementation, two sources of state.
    ensureOpenOn(
      {
        openedOn: LedgerDate.of(account.opened_on),
        closedOn: account.closed_on ? LedgerDate.of(account.closed_on) : null,
      },
      date,
      account.name,
    );
    ensureAcceptsCurrency(
      // The projection stores one column: a single allowed currency, or null
      // for an account that takes any — which the domain models as an empty
      // allow-list.
      account.currency_code ? [CurrencyCode.of(account.currency_code)] : [],
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
  private ensureReachableFrom(account: AccountRow, origin: PostingOrigin): void {
    if (!account.is_system) return;

    if (origin === PostingOrigin.SYSTEM) return;

    throw new SystemAccountProtectedException(
      `Account "${account.account_id}" is a system account and only accepts system postings`,
    );
  }

}
