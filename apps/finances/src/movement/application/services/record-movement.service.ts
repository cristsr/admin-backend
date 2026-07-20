import { Injectable } from '@nestjs/common';
import { Account, AccountRepository } from '@app/account/domain/account';
import { currentTraceId } from '@app/config/telemetry/correlation';
import { Movement, MovementRepository } from '@app/movement/domain/movement';
import { DomainEventOutboxPublisher } from '@app/outbox/application/services/domain-event-outbox.publisher';
import { MovementSaved, MovementSavedPayload } from '../movement.constants';

/** What the caller knows about the write that the movement itself does not. */
export interface RecordMovementOptions {
  /**
   * Correlation id of the request that caused the write, used only when there
   * is no active trace to take it from.
   */
  requestId?: string;

  /**
   * Effect on the account balance of the movement this write overwrites, taken
   * from {@link Movement.signedAmount} *before* the edit is applied. A caller
   * that edits in place must read it up front — once the movement carries the
   * new amount, the old one is gone.
   */
  replacedBalanceEffect?: number;
}

/**
 * The single way a movement reaches the database. Every entry point — the
 * manual API, the ingestion webhook — records through here, so the two rules
 * that must hold for *any* movement hold in one place instead of once per
 * caller: an account has to be able to fund what it pays out (AC-1, sm-0003),
 * and the movement commits together with the `movement.saved` event that
 * announces it, so a crash after commit can never lose the event (AC-2).
 */
@Injectable()
export class RecordMovementService {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly accountRepository: AccountRepository,
    private readonly outboxPublisher: DomainEventOutboxPublisher,
  ) {}

  /**
   * The correlation id is read from the ambient trace rather than passed down,
   * so nothing between the controller and here has to carry it; `requestId` is
   * the fallback for when telemetry is off.
   */
  async record(
    movement: Movement,
    account: Account,
    options: RecordMovementOptions = {},
  ): Promise<Movement> {
    await this.ensureAccountCanFund(
      movement,
      account,
      options.replacedBalanceEffect,
    );

    const correlationId = currentTraceId() ?? options.requestId;

    return this.movementRepository.runInTransaction(async (manager) => {
      const saved = await this.movementRepository.saveWithManager(
        manager,
        movement,
      );

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
   * Only the account can say whether it funds a withdrawal; the live balance it
   * needs for that is the one thing only the repository knows. An account that
   * tolerates a negative balance funds anything, so its balance is not even
   * queried.
   *
   * A movement being replaced is already part of that balance, so it is
   * discounted first — otherwise raising a $10 expense to $11 would be checked
   * as if $21 were leaving the account.
   */
  private async ensureAccountCanFund(
    movement: Movement,
    account: Account,
    replacedBalanceEffect = 0,
  ): Promise<void> {
    if (!movement.isWithdrawal()) return;
    if (account.allowNegativeBalance) return;

    const movementBalance = await this.accountRepository.movementBalance(
      account.id,
      movement.user,
    );

    account.ensureCanWithdraw(
      movement.money,
      movementBalance - replacedBalanceEffect,
    );
  }
}
