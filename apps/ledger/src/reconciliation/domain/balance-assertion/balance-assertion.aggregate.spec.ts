import { Money } from '@ledger/shared/domain/money';
import { aMoney } from '@ledger/shared/testing';
import { FixedClock } from '@ledger/shared/testing/fixed-clock';
import { SequentialIdGenerator } from '@ledger/shared/testing/sequential-id-generator';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { AssertBalanceProps, BalanceAssertion } from './balance-assertion.aggregate';
import { AssertionStatus } from './enums/assertion-status.enum';
import {
  BALANCE_ASSERTED,
  BALANCE_ASSERTION_EVALUATED,
  DISCREPANCY_RESOLVED,
} from './events';
import {
  AssertionAlreadyRevokedException,
  DiscrepancyNotResolvableException,
} from './exceptions/balance-assertion.exception';
import { AssertionEvaluation } from './types/assertion-evaluation.type';

describe('BalanceAssertion', () => {
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    ids = new SequentialIdGenerator();
  });

  const baseProps = (): AssertBalanceProps => ({
    accountId: 'acc-1',
    date: LedgerDate.of('2026-07-22'),
    occurredAt: null,
    expectedAmount: aMoney().of('1000').inUsd(),
    tolerance: Money.zero(aMoney().of('0').inUsd().currency),
  });

  const evaluation = (status: AssertionStatus, difference: string): AssertionEvaluation => ({
    status,
    actualAmount: aMoney().of('900').inUsd(),
    difference: aMoney().of(difference).inUsd(),
  });

  describe('assert', () => {
    it('emits BalanceAsserted and starts UNCHECKED', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      const events = assertion.pullChanges();

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(BALANCE_ASSERTED);
      expect(assertion.currentStatus).toBe(AssertionStatus.UNCHECKED);
    });
  });

  describe('applyEvaluation', () => {
    it('emits BalanceAssertionEvaluated when the verdict changes', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.pullChanges();

      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      const events = assertion.pullChanges();

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(BALANCE_ASSERTION_EVALUATED);
      expect(assertion.currentStatus).toBe(AssertionStatus.MISMATCHED);
      expect(assertion.difference?.toDecimalString()).toBe('100');
    });

    it('stays silent when the verdict is unchanged (idempotent re-evaluation)', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.pullChanges();

      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);

      expect(assertion.pullChanges()).toHaveLength(0);
    });

    it('emits again when the difference changes even if the status is stable', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.pullChanges();

      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '250'), clock);

      expect(assertion.pullChanges()).toHaveLength(1);
      expect(assertion.difference?.toDecimalString()).toBe('250');
    });

    it('is a silent no-op once REVOKED', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.revoke('typo');
      assertion.pullChanges();

      assertion.applyEvaluation(evaluation(AssertionStatus.MATCHED, '0'), clock);

      expect(assertion.pullChanges()).toHaveLength(0);
      expect(assertion.currentStatus).toBe(AssertionStatus.REVOKED);
    });
  });

  describe('revoke', () => {
    it('rejects revoking twice', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.revoke('typo');

      expect(() => assertion.revoke('again')).toThrow(AssertionAlreadyRevokedException);
    });
  });

  describe('markResolved', () => {
    it('resolves a MISMATCHED assertion and emits DiscrepancyResolved', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.pullChanges();

      assertion.markResolved('adjustment-txn-1');
      const events = assertion.pullChanges();

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(DISCREPANCY_RESOLVED);
      expect(assertion.isResolvable).toBe(false);
    });

    it('rejects resolving a MATCHED assertion', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.applyEvaluation(evaluation(AssertionStatus.MATCHED, '0'), clock);

      expect(() => assertion.markResolved('adjustment-txn-1')).toThrow(
        DiscrepancyNotResolvableException,
      );
    });

    it('rejects resolving twice', () => {
      const assertion = BalanceAssertion.assert(baseProps(), ids);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.markResolved('adjustment-txn-1');

      expect(() => assertion.markResolved('adjustment-txn-2')).toThrow(
        DiscrepancyNotResolvableException,
      );
    });
  });

  describe('rehydrate', () => {
    it('rebuilds status, difference and version after N events', () => {
      const source = BalanceAssertion.assert(baseProps(), ids);
      source.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      source.markResolved('adjustment-txn-1');
      const stream = source.pullChanges() as DomainEvent[];

      const rebuilt = BalanceAssertion.rehydrate(source.id, stream);

      expect(rebuilt.currentStatus).toBe(AssertionStatus.MISMATCHED);
      expect(rebuilt.difference?.toDecimalString()).toBe('100');
      expect(rebuilt.version).toBe(3);
      expect(rebuilt.isResolvable).toBe(false);
    });
  });
});
