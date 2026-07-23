import { Money } from '@ledger/shared/domain/money';

/** Plain construction shape for a {@link PostingLine}. */
export type PostingLineProps = {
  readonly accountId: string;
  readonly amount: Money;
  readonly metadata: Readonly<Record<string, string>>;
};

/**
 * A single ledger posting: an account reference plus a signed {@link Money} and
 * free-form metadata (§2.3). The currency is carried by `Money`, so there is
 * never an amount without a currency (principle §9.4.1). Immutable.
 */
export class PostingLine {
  readonly accountId: string;
  readonly amount: Money;
  readonly metadata: Readonly<Record<string, string>>;

  private constructor(props: PostingLineProps) {
    this.accountId = props.accountId;
    this.amount = props.amount;
    this.metadata = Object.freeze({ ...props.metadata });
  }

  static of(props: PostingLineProps): PostingLine {
    return new PostingLine(props);
  }

  get currencyCode(): string {
    return this.amount.currency.code;
  }

  /** Flips the amount sign, keeping account and metadata; used to build reversals. */
  negated(): PostingLine {
    return new PostingLine({
      accountId: this.accountId,
      amount: this.amount.negate(),
      metadata: this.metadata,
    });
  }
}
