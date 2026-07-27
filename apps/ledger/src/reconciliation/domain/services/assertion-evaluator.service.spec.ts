import { SequentialIdGenerator } from '@cqrs/testing';
import { InMemoryAssertionPostingReader } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader';
import { Currency, Money } from '@ledger/shared/domain/money';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { AssertBalanceProps, BalanceAssertion } from '../balance-assertion/balance-assertion.aggregate';
import { AssertionStatus } from '../balance-assertion/enums/assertion-status.enum';
import { AssertionCutoff, AssertionEvaluator } from './assertion-evaluator.service';
import { IntlDayBoundaryResolver } from './day-boundary.resolver';

describe('AssertionEvaluator', () => {
  const usd = Currency.of('USD', 2);
  const timezone = 'America/Bogota'; // UTC-5, no DST

  let ids: SequentialIdGenerator;
  let reader: InMemoryAssertionPostingReader;
  let evaluator: AssertionEvaluator;

  beforeEach(() => {
    ids = new SequentialIdGenerator();
    reader = new InMemoryAssertionPostingReader();
    evaluator = new AssertionEvaluator(reader, new IntlDayBoundaryResolver());
  });

  const assertOf = (
    expected: string,
    tolerance: string,
    occurredAt: Date | null = null,
  ): BalanceAssertion => {
    const props: AssertBalanceProps = {
      accountId: 'acc-1',
      date: LedgerDate.of('2026-07-22'),
      occurredAt,
      expectedAmount: Money.of(expected, usd),
      tolerance: Money.of(tolerance, usd),
    };

    return BalanceAssertion.assert(props, ids);
  };

  const posting = (
    amount: string,
    date: string,
    occurredAt: Date | null,
    status = TransactionStatus.CONFIRMED,
  ) => ({ amount: Money.of(amount, usd), date: LedgerDate.of(date), occurredAt, status });

  const cutoffOf = (assertion: BalanceAssertion): AssertionCutoff => ({
    date: assertion.assertedDate,
    occurredAt: assertion.assertedOccurredAt,
    timezone,
  });

  it('MATCHED at close of day when postings sum to the expected balance', async () => {
    reader
      .add('user-1', 'acc-1', posting('600', '2026-07-20', null))
      .add('user-1', 'acc-1', posting('400', '2026-07-22', null));

    const assertion = assertOf('1000', '0');
    const result = await evaluator.evaluate('user-1', assertion, cutoffOf(assertion));

    expect(result.status).toBe(AssertionStatus.MATCHED);
    expect(result.difference.toDecimalString()).toBe('0');
  });

  it('MISMATCHED with the exact signed missing amount', async () => {
    reader.add('user-1', 'acc-1', posting('600', '2026-07-20', null));

    const assertion = assertOf('1000', '0');
    const result = await evaluator.evaluate('user-1', assertion, cutoffOf(assertion));

    expect(result.status).toBe(AssertionStatus.MISMATCHED);
    expect(result.difference.toDecimalString()).toBe('400'); // expected - actual
  });

  it('honours tolerance: within tolerance is MATCHED, zero tolerance is MISMATCHED', async () => {
    reader.add('user-1', 'acc-1', posting('950', '2026-07-20', null));

    const tolerant = assertOf('1000', '100');
    expect((await evaluator.evaluate('user-1', tolerant, cutoffOf(tolerant))).status).toBe(
      AssertionStatus.MATCHED,
    );

    const strict = assertOf('1000', '0');
    expect((await evaluator.evaluate('user-1', strict, cutoffOf(strict))).status).toBe(
      AssertionStatus.MISMATCHED,
    );
  });

  it('includes PENDING and never VOIDED postings', async () => {
    reader
      .add('user-1', 'acc-1', posting('600', '2026-07-20', null, TransactionStatus.CONFIRMED))
      .add('user-1', 'acc-1', posting('400', '2026-07-21', null, TransactionStatus.PENDING))
      .add('user-1', 'acc-1', posting('999', '2026-07-21', null, TransactionStatus.VOIDED));

    const assertion = assertOf('1000', '0');
    const result = await evaluator.evaluate('user-1', assertion, cutoffOf(assertion));

    expect(result.status).toBe(AssertionStatus.MATCHED);
  });

  it('intraday: a later same-day instant is excluded with certainty', async () => {
    reader
      .add(
        'user-1',
        'acc-1',
        posting('600', '2026-07-22', new Date('2026-07-22T13:00:00.000Z')),
      )
      .add(
        'user-1',
        'acc-1',
        posting('400', '2026-07-22', new Date('2026-07-22T18:00:00.000Z')),
      );

    // Cutoff at 15:00Z includes the 13:00 leg, excludes the 18:00 one.
    const assertion = assertOf('600', '0', new Date('2026-07-22T15:00:00.000Z'));
    const result = await evaluator.evaluate('user-1', assertion, cutoffOf(assertion));

    expect(result.status).toBe(AssertionStatus.MATCHED);
  });

  it('INDETERMINATE when a same-day posting without occurred_at could flip the verdict', async () => {
    reader
      .add(
        'user-1',
        'acc-1',
        posting('600', '2026-07-22', new Date('2026-07-22T13:00:00.000Z')),
      )
      .add('user-1', 'acc-1', posting('400', '2026-07-22', null)); // ambiguous, non-zero

    const assertion = assertOf('1000', '0', new Date('2026-07-22T15:00:00.000Z'));
    const result = await evaluator.evaluate('user-1', assertion, cutoffOf(assertion));

    // Without ambiguous: actual 600, diff 400 (out). With ambiguous: actual 1000, diff 0 (in).
    expect(result.status).toBe(AssertionStatus.INDETERMINATE);
    expect(result.difference.toDecimalString()).toBe('400'); // deterministic scenario
  });

  it('a neutral (zero-sum) same-day ambiguous posting resolves deterministically', async () => {
    reader
      .add(
        'user-1',
        'acc-1',
        posting('1000', '2026-07-22', new Date('2026-07-22T13:00:00.000Z')),
      )
      .add('user-1', 'acc-1', posting('0', '2026-07-22', null));

    const assertion = assertOf('1000', '0', new Date('2026-07-22T15:00:00.000Z'));
    const result = await evaluator.evaluate('user-1', assertion, cutoffOf(assertion));

    expect(result.status).toBe(AssertionStatus.MATCHED);
  });

  it('timezone boundary: a 03:00Z instant belongs to the previous local day (UTC-5)', async () => {
    // 2026-07-22T03:00Z is 2026-07-21 22:00 in America/Bogota → previous local day,
    // so it is included with certainty relative to a 2026-07-22 intraday cutoff.
    reader.add(
      'user-1',
      'acc-1',
      posting('1000', '2026-07-22', new Date('2026-07-22T03:00:00.000Z')),
    );

    const assertion = assertOf('1000', '0', new Date('2026-07-22T15:00:00.000Z'));
    const result = await evaluator.evaluate('user-1', assertion, cutoffOf(assertion));

    expect(result.status).toBe(AssertionStatus.MATCHED);
  });
});
