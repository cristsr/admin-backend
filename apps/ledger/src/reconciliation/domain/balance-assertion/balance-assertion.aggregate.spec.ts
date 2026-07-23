import { Money } from '@ledger/shared/domain/money';
import { AuthenticatedContext, DomainEvent, LocalDate } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { aMoney } from '@ledger/shared/testing';
import { FixedClock } from '@ledger/shared/testing/fixed-clock';
import { AssertBalanceProps, BalanceAssertion } from './balance-assertion.aggregate';
import { AssertionStatus } from './enums/assertion-status.enum';
import { BALANCE_ASSERTED, BALANCE_ASSERTION_EVALUATED, DISCREPANCY_RESOLVED } from './events';
import {
  AssertionAlreadyRevokedException,
  DiscrepancyNotResolvableException,
} from './exceptions/balance-assertion.exception';
import { AssertionEvaluation } from './types/assertion-evaluation.type';

describe('BalanceAssertion', () => {
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const context = new AuthenticatedContext('user-1', 'client-1');

  const baseProps = (): AssertBalanceProps => ({
    assertionId: 'assert-1',
    context,
    externalRef: 'ext-1',
    accountId: 'acc-1',
    date: LocalDate.of('2026-07-22'),
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
    it('emits BalanceAsserted at sequence 1 and starts UNCHECKED', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      const events = assertion.pullEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(BALANCE_ASSERTED);
      expect(events[0].sequence).toBe(1);
      expect(events[0].externalRef).toBe('ext-1');
      expect(assertion.currentStatus).toBe(AssertionStatus.UNCHECKED);
    });
  });

  describe('applyEvaluation', () => {
    it('emits BalanceAssertionEvaluated when the verdict changes', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.pullEvents();

      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      const events = assertion.pullEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(BALANCE_ASSERTION_EVALUATED);
      expect(assertion.currentStatus).toBe(AssertionStatus.MISMATCHED);
      expect(assertion.difference?.toDecimalString()).toBe('100');
    });

    it('stays silent when the verdict is unchanged (idempotent re-evaluation)', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.pullEvents();

      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);

      expect(assertion.pullEvents()).toHaveLength(0);
    });

    it('emits again when the difference changes even if the status is stable', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.pullEvents();

      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '250'), clock);

      expect(assertion.pullEvents()).toHaveLength(1);
      expect(assertion.difference?.toDecimalString()).toBe('250');
    });

    it('is a silent no-op once REVOKED', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.revoke('typo', clock);
      assertion.pullEvents();

      assertion.applyEvaluation(evaluation(AssertionStatus.MATCHED, '0'), clock);

      expect(assertion.pullEvents()).toHaveLength(0);
      expect(assertion.currentStatus).toBe(AssertionStatus.REVOKED);
    });
  });

  describe('revoke', () => {
    it('rejects revoking twice', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.revoke('typo', clock);

      expect(() => assertion.revoke('again', clock)).toThrow(AssertionAlreadyRevokedException);
    });
  });

  describe('markResolved', () => {
    it('resolves a MISMATCHED assertion and emits DiscrepancyResolved', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.pullEvents();

      assertion.markResolved('adjustment-txn-1', clock);
      const events = assertion.pullEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(DISCREPANCY_RESOLVED);
      expect(assertion.isResolvable).toBe(false);
    });

    it('rejects resolving a MATCHED assertion', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.applyEvaluation(evaluation(AssertionStatus.MATCHED, '0'), clock);

      expect(() => assertion.markResolved('adjustment-txn-1', clock)).toThrow(
        DiscrepancyNotResolvableException,
      );
    });

    it('rejects resolving twice', () => {
      const assertion = BalanceAssertion.assert(baseProps(), clock);
      assertion.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      assertion.markResolved('adjustment-txn-1', clock);

      expect(() => assertion.markResolved('adjustment-txn-2', clock)).toThrow(
        DiscrepancyNotResolvableException,
      );
    });
  });

  describe('fromHistory', () => {
    it('rebuilds status, difference and version after N events', () => {
      const source = BalanceAssertion.assert(baseProps(), clock);
      source.applyEvaluation(evaluation(AssertionStatus.MISMATCHED, '100'), clock);
      source.markResolved('adjustment-txn-1', clock);
      const stream = source.pullEvents() as DomainEvent[];

      const rebuilt = BalanceAssertion.fromHistory(stream);

      expect(rebuilt.currentStatus).toBe(AssertionStatus.MISMATCHED);
      expect(rebuilt.difference?.toDecimalString()).toBe('100');
      expect(rebuilt.currentVersion).toBe(3);
      expect(rebuilt.isResolvable).toBe(false);
    });
  });
});
