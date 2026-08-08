import { Nullable } from '@shared';
import { CurrencyCode, LedgerDate } from '@ledger/shared/domain/value-objects';
import { AccountClosedException, CurrencyNotAllowedException } from './exceptions/account.exception';

/** The window an account is postable in. */
export type OpenWindow = {
  readonly openedOn: LedgerDate;
  readonly closedOn: Nullable<LedgerDate>;
};

/**
 * INV-3 and INV-4 as pure predicates, so the one rule has one implementation.
 *
 * Two callers need them and neither can be the other: the {@link Account}
 * aggregate holds one account's own state, while `AccountValidationService`
 * checks a whole posting set against the `account_tree` projection and cannot
 * load an aggregate per leg. What must not differ is the rule itself — it was
 * written twice, with the same exceptions, and only the aggregate's copy had
 * tests.
 *
 * `subject` is only for the message; both callers name the account.
 */
export function ensureOpenOn(window: OpenWindow, date: LedgerDate, subject: string): void {
  if (date.isBefore(window.openedOn)) {
    throw new AccountClosedException(`Account "${subject}" was not open on ${date.value}`);
  }

  if (window.closedOn && date.isAfter(window.closedOn)) {
    throw new AccountClosedException(
      `Account "${subject}" was closed on ${window.closedOn.value}`,
    );
  }
}

/**
 * INV-4: the posting currency must be allowed. An empty allow-list means the
 * account takes any currency — the case a real account never has.
 */
export function ensureAcceptsCurrency(
  allowed: readonly CurrencyCode[],
  code: CurrencyCode,
  subject: string,
): void {
  if (!allowed.length) return;

  if (!allowed.some((accepted) => accepted.equals(code))) {
    throw new CurrencyNotAllowedException(
      `Account "${subject}" does not accept ${code.value}`,
    );
  }
}
