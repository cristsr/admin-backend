import { Money } from '@ledger/shared/domain/money';
import {
  CurrencyCatalog,
  CurrencyCode,
} from '@ledger/shared/domain/value-objects';
import { PostingInput } from '@ledger/transactions/application/types/posting-input.type';
import { PostingLine } from '@ledger/shared/domain/posting/posting-line';

/** Builds domain {@link PostingLine}s from API-shaped inputs, resolving scale via the catalog. */
export function toPostingLines(
  inputs: readonly PostingInput[],
  catalog: CurrencyCatalog,
): PostingLine[] {
  return inputs.map((input) =>
    PostingLine.of({
      accountId: input.accountId,
      amount: Money.of(input.amount, catalog.resolve(CurrencyCode.of(input.currency))),
      metadata: input.metadata ?? {},
    }),
  );
}
