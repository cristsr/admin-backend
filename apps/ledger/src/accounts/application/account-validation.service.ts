import { Criteria, Nullable } from '@shared';
import {
  AccountClosedException,
  CurrencyNotAllowedException,
} from '@ledger/accounts/domain/account/exceptions/account.exception';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { AccountNotFoundException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import {
  AccountType,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared-kernel/domain/value-objects';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';

type AccountRow = {
  readonly account_id: string;
  readonly type: string;
  readonly currency_code: Nullable<string>;
  readonly opened_on: string;
  readonly closed_on: Nullable<string>;
};

/**
 * Cross-aggregate validation of postings against `account_tree` (§3.5): each
 * referenced account must exist, be open on the transaction date (INV-3) and
 * accept the posting currency (INV-4). Consistency is relaxed — the tree is a
 * projection — but a miss surfaces as a typed error, never corruption.
 */
export class AccountValidationService {
  constructor(private readonly readModel: ReadModelStore) {}

  /** Validates every posting and returns the touched account types (for RF-4). */
  async validate(
    userId: string,
    date: LedgerDate,
    postings: readonly PostingLine[],
  ): Promise<readonly AccountType[]> {
    const accounts = await this.readModel.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId),
    );
    const byId = new Map(accounts.map((account) => [account.account_id, account]));

    return postings.map((posting) => this.validatePosting(posting, date, byId));
  }

  private validatePosting(
    posting: PostingLine,
    date: LedgerDate,
    byId: Map<string, AccountRow>,
  ): AccountType {
    const account = byId.get(posting.accountId);

    if (!account) {
      throw new AccountNotFoundException(`Account "${posting.accountId}" does not exist`);
    }

    this.ensureOpenOn(account, date);
    this.ensureAcceptsCurrency(account, posting.currencyCode);

    return account.type as AccountType;
  }

  private ensureOpenOn(account: AccountRow, date: LedgerDate): void {
    const openedOn = LedgerDate.of(account.opened_on);

    if (date.isBefore(openedOn)) {
      throw new AccountClosedException(`Account was not open on ${date.value}`);
    }

    if (account.closed_on && date.isAfter(LedgerDate.of(account.closed_on))) {
      throw new AccountClosedException(`Account was closed on ${account.closed_on}`);
    }
  }

  private ensureAcceptsCurrency(account: AccountRow, currencyCode: string): void {
    if (!account.currency_code) return;

    if (account.currency_code !== CurrencyCode.of(currencyCode).value) {
      throw new CurrencyNotAllowedException(
        `Account does not accept ${currencyCode}; expected ${account.currency_code}`,
      );
    }
  }
}
