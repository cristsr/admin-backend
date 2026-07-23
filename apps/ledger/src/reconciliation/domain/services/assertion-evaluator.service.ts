import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { LocalDate } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { BalanceAssertion } from '../balance-assertion/balance-assertion.aggregate';
import { AssertionStatus } from '../balance-assertion/enums/assertion-status.enum';
import { AssertionCurrencyMismatchException } from '../balance-assertion/exceptions/balance-assertion.exception';
import { AssertionEvaluation } from '../balance-assertion/types/assertion-evaluation.type';
import { AssertablePosting, AssertionPostingReader } from '../ports/assertion-posting-reader.port';
import { DayBoundaryResolver } from './day-boundary.resolver';

/** Temporal cutoff of an assertion: its date, optional intraday instant, timezone. */
export interface AssertionCutoff {
  readonly date: LocalDate;
  readonly occurredAt: Nullable<Date>;
  readonly timezone: string;
}

/** Internal partition of the evaluable population against the cutoff. */
interface Partition {
  readonly included: readonly AssertablePosting[];
  readonly ambiguous: readonly AssertablePosting[];
}

/**
 * Computes an assertion's verdict and exact difference against the projected
 * balance of the exact account (no subaccounts, §2.4). Pure domain service: no
 * NestJS transport, no SQL — it reads the population through a port. `difference`
 * is always `expected - actual`.
 */
@Injectable()
export class AssertionEvaluator {
  constructor(
    private readonly reader: AssertionPostingReader,
    private readonly dayBoundary: DayBoundaryResolver,
  ) {}

  async evaluate(assertion: BalanceAssertion, cutoff: AssertionCutoff): Promise<AssertionEvaluation> {
    const expected = assertion.expectedAmount;
    const currency = expected.currency;

    const population = await this.reader.byAccountUpToDate(
      assertion.owner,
      assertion.account,
      cutoff.date,
    );

    this.ensureSameCurrency(population, currency.code);

    const { included, ambiguous } = this.partition(population, cutoff);

    const actual = this.sum(included, currency);
    const difference = expected.subtract(actual);

    const status = this.verdict(expected, actual, ambiguous, assertion.toleranceAmount);

    return { status, actualAmount: actual, difference };
  }

  private partition(population: readonly AssertablePosting[], cutoff: AssertionCutoff): Partition {
    // Close-of-day cutoff: every posting up to the date counts; no ordering doubt.
    if (!cutoff.occurredAt) {
      return { included: population, ambiguous: [] };
    }

    const included: AssertablePosting[] = [];
    const ambiguous: AssertablePosting[] = [];

    for (const posting of population) {
      this.classifyIntraday(posting, cutoff, included, ambiguous);
    }

    return { included, ambiguous };
  }

  private classifyIntraday(
    posting: AssertablePosting,
    cutoff: AssertionCutoff,
    included: AssertablePosting[],
    ambiguous: AssertablePosting[],
  ): void {
    // Postings without an instant fall back to their accounting date.
    if (!posting.occurredAt) {
      if (posting.date.isBefore(cutoff.date)) included.push(posting);
      else ambiguous.push(posting);

      return;
    }

    // With an instant, the true local day (via timezone) decides membership,
    // so a UTC time that lands on a different local day is placed correctly.
    const localDay = this.dayBoundary.localDateOf(posting.occurredAt, cutoff.timezone);

    if (localDay.isBefore(cutoff.date)) {
      included.push(posting);

      return;
    }

    if (localDay.isAfter(cutoff.date)) return; // certainly later — excluded

    if (posting.occurredAt.getTime() <= (cutoff.occurredAt as Date).getTime()) included.push(posting);
    // else: same local day but strictly after the cutoff instant — excluded.
  }

  private verdict(
    expected: Money,
    actual: Money,
    ambiguous: readonly AssertablePosting[],
    tolerance: Money,
  ): AssertionStatus {
    const differenceWithout = expected.subtract(actual);
    const withinWithout = this.isWithinTolerance(differenceWithout, tolerance);

    const ambiguousSum = this.sum(ambiguous, expected.currency);

    // No ambiguity, or ambiguity that nets to zero: deterministic resolution.
    if (!ambiguous.length || ambiguousSum.isZero()) {
      return withinWithout ? AssertionStatus.MATCHED : AssertionStatus.MISMATCHED;
    }

    const differenceWith = expected.subtract(actual.add(ambiguousSum));
    const withinWith = this.isWithinTolerance(differenceWith, tolerance);

    // Both scenarios agree it matches → MATCHED; otherwise the ambiguity could
    // flip the verdict, so stay conservative (§2.4, open question #6).
    if (withinWithout && withinWith) return AssertionStatus.MATCHED;

    return AssertionStatus.INDETERMINATE;
  }

  private isWithinTolerance(difference: Money, tolerance: Money): boolean {
    const magnitude = difference.isNegative() ? difference.negate() : difference;

    return magnitude.compareTo(tolerance) <= 0;
  }

  private sum(postings: readonly AssertablePosting[], currency: Money['currency']): Money {
    return postings.reduce((total, posting) => total.add(posting.amount), Money.zero(currency));
  }

  private ensureSameCurrency(population: readonly AssertablePosting[], expectedCode: string): void {
    const offending = population.find((posting) => posting.amount.currency.code !== expectedCode);

    if (!offending) return;

    throw new AssertionCurrencyMismatchException(
      `Account holds ${offending.amount.currency.code} but the assertion is in ${expectedCode}`,
    );
  }
}
