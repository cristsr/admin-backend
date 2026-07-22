import { Injectable } from '@nestjs/common';
import { Account, AccountRepository } from '@app/account/domain/account';
import { currentTraceId } from '@app/config/telemetry/correlation';
import { Movement, MovementRepository } from '@app/movement/domain/movement';
import { DomainEventOutboxPublisher } from '@app/outbox/application/services/domain-event-outbox.publisher';
import { MovementSavedPayload } from '../movement-saved-payload.type';
import { MovementSaved } from '../movement.constants';
import { RecordMovementOptions } from './record-movement-options.type';

/**
 * Single entry point for recording a movement: enforces account funding and
 * commits the movement together with its `movement.saved` outbox event.
 */
@Injectable()
export class RecordMovementService {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly accountRepository: AccountRepository,
    private readonly outboxPublisher: DomainEventOutboxPublisher,
  ) {}

  /**
   * Correlation id comes from the ambient trace; `requestId` is the fallback
   * when telemetry is off.
   */
  async record(movement: Movement, account: Account, options: RecordMovementOptions = {}): Promise<Movement> {
    await this.ensureAccountCanFund(movement, account, options.replacedBalanceEffect);

    const correlationId = currentTraceId() ?? options.requestId;

    return this.movementRepository.runInTransaction(async (manager) => {
      const saved = await this.movementRepository.saveWithManager(manager, movement);

      await this.outboxPublisher.publish(manager, {
        eventType: MovementSaved,
        payload: {
          categoryId: saved.categoryId,
          accountId: saved.accountId,
          date: saved.date,
          amount: saved.money.amount,
          user: saved.user,
          correlationId,
        } satisfies MovementSavedPayload,
      });

      return saved;
    });
  }

  /**
   * Withdrawals must be fundable by the account; the replaced movement's
   * effect is discounted so an edit is checked only for the difference.
   */
  private async ensureAccountCanFund(
    movement: Movement,
    account: Account,
    replacedBalanceEffect = 0,
  ): Promise<void> {
    if (!movement.isWithdrawal()) return;
    if (account.allowNegativeBalance) return;

    const movementBalance = await this.accountRepository.movementBalance(account.id, movement.user);

    account.ensureCanWithdraw(movement.money, movementBalance - replacedBalanceEffect);
  }
}
