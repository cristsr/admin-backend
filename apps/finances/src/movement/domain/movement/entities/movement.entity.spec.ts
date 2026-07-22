import { Money } from '@app/shared/domain';
import { MovementNotEditableException } from '../exceptions/movement.exception';
import { MovementSource, MovementType } from '../types/movement.types';
import { Movement } from './movement.entity';

const buildMovement = (overrides: Partial<Movement> = {}) =>
  Movement.create({
    id: 1,
    type: MovementType.EXPENSE,
    source: MovementSource.MANUAL,
    description: 'Coffee',
    notes: 'note',
    merchant: 'UBER TRIP',
    money: Money.of(100, 'USD'),
    categoryId: 3,
    subcategoryId: 9,
    accountId: 2,
    user: 7,
    ...overrides,
  } as Movement);

describe('Movement', () => {
  describe('named constructors', () => {
    const attributes = {
      date: new Date(),
      type: MovementType.EXPENSE,
      description: 'Coffee',
      money: Money.of(10, 'USD'),
      accountId: 2,
      user: 7,
    };

    it('stamps the source that recorded it', () => {
      expect(Movement.manual(attributes).source).toBe(MovementSource.MANUAL);
      expect(Movement.fromSchedule(attributes).source).toBe(MovementSource.SCHEDULED);
      expect(
        Movement.fromWebhook({
          ...attributes,
          merchant: 'X',
          externalReference: 'ext-1',
        }).source,
      ).toBe(MovementSource.WEBHOOK);
    });

    it('marks a transfer leg as such', () => {
      const leg = Movement.transferLeg({
        ...attributes,
        type: MovementType.TRANSFER_OUT,
        transferGroup: 'grp',
      });

      expect(leg.isTransferLeg()).toBe(true);
      expect(leg.transferGroup).toBe('grp');
    });
  });

  describe('applyPatch', () => {
    it('applies only the fields present in the patch', () => {
      const movement = buildMovement();

      movement.applyPatch({ notes: 'new note' });

      expect(movement.notes).toBe('new note');
      expect(movement.description).toBe('Coffee');
      expect(movement.money.amount).toBe(100);
    });

    it('keeps the currency when the amount changes', () => {
      const movement = buildMovement();

      movement.applyPatch({ amount: 250 });

      expect(movement.money.amount).toBe(250);
      expect(movement.money.currency).toBe('USD');
    });

    it('refuses to edit a transfer leg', () => {
      const leg = buildMovement({ type: MovementType.TRANSFER_OUT });

      expect(() => leg.applyPatch({ notes: 'x' })).toThrow(MovementNotEditableException);
    });

    it('refuses to edit ingestion-owned fields on a webhook movement', () => {
      const ingested = buildMovement({ source: MovementSource.WEBHOOK });

      expect(() => ingested.applyPatch({ amount: 999 })).toThrow(MovementNotEditableException);
      expect(() => ingested.applyPatch({ description: 'x' })).toThrow(MovementNotEditableException);
    });

    it('allows the user-owned fields on a webhook movement', () => {
      const ingested = buildMovement({ source: MovementSource.WEBHOOK });

      ingested.applyPatch({ notes: 'mine', categoryId: 12 });

      expect(ingested.notes).toBe('mine');
      expect(ingested.categoryId).toBe(12);
      expect(ingested.merchant).toBe('UBER TRIP');
    });

    it('ignores keys explicitly set to undefined', () => {
      const ingested = buildMovement({ source: MovementSource.WEBHOOK });

      expect(() => ingested.applyPatch({ amount: undefined, notes: 'mine' })).not.toThrow();
    });
  });

  describe('reversal legs', () => {
    it('inverts the direction of a transfer leg and keeps the amount', () => {
      const leg = buildMovement({
        type: MovementType.TRANSFER_OUT,
        transferGroup: 'grp',
      });

      const compensation = leg.reversalLeg('reversal:grp', 'Reversal');

      expect(compensation.type).toBe(MovementType.TRANSFER_IN);
      expect(compensation.money.amount).toBe(100);
      expect(compensation.accountId).toBe(2);
      expect(compensation.transferGroup).toBe('reversal:grp');
    });

    it('inverts an expense into an income when reversing an ingested movement', () => {
      const ingested = buildMovement({
        source: MovementSource.WEBHOOK,
        externalReference: 'ext-1',
      });

      const compensation = ingested.reversal('reversal:ext-1');

      expect(compensation.type).toBe(MovementType.INCOME);
      expect(compensation.externalReference).toBe('reversal:ext-1');
      expect(compensation.money.amount).toBe(100);
    });
  });
});
