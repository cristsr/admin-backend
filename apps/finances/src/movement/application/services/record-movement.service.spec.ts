import { Account, InsufficientBalanceException } from '@app/account/domain/account';
import { Movement, MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { MovementSaved } from '../movement.constants';
import { RecordMovementService } from './record-movement.service';

describe('RecordMovementService', () => {
  let movementRepository: any;
  let accountRepository: any;
  let outboxPublisher: any;
  let service: RecordMovementService;

  const account = (allowNegativeBalance: boolean, initial = 100) =>
    Account.create({
      id: 3,
      name: 'Checking',
      initialBalance: Money.of(initial, 'USD'),
      allowNegativeBalance,
    } as never);

  const movement = (type: MovementType, amount: number) =>
    Movement.manual({
      date: new Date(),
      type,
      description: 'Coffee',
      money: Money.of(amount, 'USD'),
      accountId: 3,
      user: 42,
    });

  beforeEach(() => {
    const fakeManager = { id: 'manager' };
    movementRepository = {
      runInTransaction: jest.fn().mockImplementation((work) => work(fakeManager)),
      saveWithManager: jest.fn().mockImplementation(async (_manager, m) => ({ ...m, id: 100 })),
    };
    accountRepository = { movementBalance: jest.fn().mockResolvedValue(0) };
    outboxPublisher = { publish: jest.fn() };
    service = new RecordMovementService(movementRepository, accountRepository, outboxPublisher);
  });

  describe('funding rule', () => {
    it('refuses an expense the account cannot fund', async () => {
      await expect(service.record(movement(MovementType.EXPENSE, 150), account(false))).rejects.toThrow(
        InsufficientBalanceException,
      );

      expect(movementRepository.saveWithManager).not.toHaveBeenCalled();
    });

    it('records an expense the account can fund', async () => {
      await service.record(movement(MovementType.EXPENSE, 80), account(false));

      expect(movementRepository.saveWithManager).toHaveBeenCalled();
    });

    it('lets an account that may go negative fund anything, without querying its balance', async () => {
      await service.record(movement(MovementType.EXPENSE, 5000), account(true));

      expect(movementRepository.saveWithManager).toHaveBeenCalled();
      expect(accountRepository.movementBalance).not.toHaveBeenCalled();
    });

    it('does not check funding for income, which only adds to the balance', async () => {
      await service.record(movement(MovementType.INCOME, 5000), account(false));

      expect(accountRepository.movementBalance).not.toHaveBeenCalled();
      expect(movementRepository.saveWithManager).toHaveBeenCalled();
    });

    it('checks the outgoing leg of a transfer like any other withdrawal', async () => {
      await expect(service.record(movement(MovementType.TRANSFER_OUT, 150), account(false))).rejects.toThrow(
        InsufficientBalanceException,
      );
    });

    it('discounts the movement being replaced before judging an edit', async () => {
      accountRepository.movementBalance.mockResolvedValue(-80);

      await service.record(movement(MovementType.EXPENSE, 90), account(false), {
        replacedBalanceEffect: -80,
      });

      expect(movementRepository.saveWithManager).toHaveBeenCalled();
    });

    it('still refuses an edit that pushes past what the account holds', async () => {
      accountRepository.movementBalance.mockResolvedValue(-80);

      await expect(
        service.record(movement(MovementType.EXPENSE, 150), account(false), {
          replacedBalanceEffect: -80,
        }),
      ).rejects.toThrow(InsufficientBalanceException);
    });
  });

  describe('transactional outbox', () => {
    it('writes the movement and its event with the same transaction manager', async () => {
      await service.record(movement(MovementType.EXPENSE, 10), account(false));

      const savedManager = movementRepository.saveWithManager.mock.calls[0][0];
      const publishManager = outboxPublisher.publish.mock.calls[0][0];
      expect(publishManager).toBe(savedManager);
    });

    it('publishes movement.saved with the plain amount, not the Money value object', async () => {
      await service.record(movement(MovementType.EXPENSE, 10), account(false));

      expect(outboxPublisher.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: MovementSaved,
          payload: expect.objectContaining({ amount: 10, user: 42 }),
        }),
      );
    });

    it('carries the request id as correlation id when no trace is active', async () => {
      await service.record(movement(MovementType.EXPENSE, 10), account(false), {
        requestId: 'corr-abc',
      });

      expect(outboxPublisher.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payload: expect.objectContaining({ correlationId: 'corr-abc' }),
        }),
      );
    });

    it('publishes nothing when the account refuses to fund the movement', async () => {
      await expect(service.record(movement(MovementType.EXPENSE, 150), account(false))).rejects.toThrow(
        InsufficientBalanceException,
      );

      expect(outboxPublisher.publish).not.toHaveBeenCalled();
      expect(movementRepository.runInTransaction).not.toHaveBeenCalled();
    });
  });
});
