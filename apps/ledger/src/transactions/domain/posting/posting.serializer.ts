import { Money } from '@ledger/shared/domain/money';
import {
  CurrencyCatalog,
  CurrencyCode,
} from '@ledger/shared/domain/value-objects';
import { PostingLine } from './posting-line';

/** JSON shape of a posting inside an event payload (amounts as decimal strings). */
export type PostingPayload = {
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
  readonly metadata: Readonly<Record<string, string>>;
};

/**
 * Maps {@link PostingLine} to and from its event payload. Serialization keeps
 * amounts as decimal strings (RNF-2); deserialization rebuilds `Money` at the
 * currency's precision via the {@link CurrencyCatalog} (INV-8).
 */
export class PostingSerializer {
  static toPayload(posting: PostingLine): PostingPayload {
    return {
      accountId: posting.accountId,
      amount: posting.amount.toDecimalString(),
      currency: posting.currencyCode,
      metadata: posting.metadata,
    };
  }

  static fromPayload(raw: PostingPayload, catalog: CurrencyCatalog): PostingLine {
    const currency = catalog.resolve(CurrencyCode.of(raw.currency));

    return PostingLine.of({
      accountId: raw.accountId,
      amount: Money.of(raw.amount, currency),
      metadata: raw.metadata ?? {},
    });
  }
}
