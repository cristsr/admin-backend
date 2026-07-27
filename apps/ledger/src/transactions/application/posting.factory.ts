import { Money } from '@ledger/shared/domain/money';
import {
  CurrencyCatalog,
  CurrencyCode,
} from '@ledger/shared/domain/value-objects';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { PostingInput } from './posting-input.type';

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
