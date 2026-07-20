import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import {
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import { CategoryResolver } from '@app/categorization-rule/domain/categorization-rule';
import { currentTraceId } from '@app/config/telemetry/correlation';
import {
  Movement,
  MovementNotFoundException,
  MovementRepository,
  NewMovement,
} from '@app/movement/domain/movement';
import { DomainEventOutboxPublisher } from '@app/outbox/application/services/domain-event-outbox.publisher';
import { Money } from '@app/shared/domain';
import { MovementInputDto } from '../dto/movement-input.dto';
import { MovementSaved, MovementSavedPayload } from '../movement.constants';

@Injectable()
export class SaveMovementUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryResolver: CategoryResolver,
    private readonly outboxPublisher: DomainEventOutboxPublisher,
  ) {}

  /**
   * `requestId` is only a fallback: when telemetry is on, the trace id in
   * context wins, because that is the id the collector knows this flow by. It
   * is read here instead of being passed down, so nothing below has to carry it.
   */
  async execute(
    input: MovementInputDto,
    user: number,
    requestId?: string,
  ): Promise<Movement> {
    const correlationId = currentTraceId() ?? requestId;

    const [existing, account] = await Promise.all([
      input.id
        ? this.movementRepository.findByIdAndUser(input.id, user)
        : null,
      this.accountRepository.findByIdAndUser(input.account, user),
    ]);

    if (input.id && !existing) {
      throw new MovementNotFoundException('Movement not found');
    }

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const { categoryId, subcategoryId } =
      await this.categoryResolver.resolveByIds(
        { categoryId: input.category, subcategoryId: input.subcategory },
        { description: input.description },
        user,
      );

    const movement = SaveMovementUsecase.build(
      {
        date: input.date,
        type: input.type,
        description: input.description,
        notes: input.notes,
        money: Money.of(input.amount, input.currency),
        paymentMethod: input.paymentMethod,
        categoryId,
        subcategoryId,
        accountId: account.id,
        user,
      },
      existing,
    );

    // AC-2: the movement and its domain event commit together. The outbox relay
    // re-emits movement.saved later, so a crash after commit never loses it.
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
        } as MovementSavedPayload,
      });

      return saved;
    });
  }

  /**
   * Re-saving an existing movement keeps the source that recorded it — a
   * webhook movement does not become manual because it was saved again — while
   * a brand new one is manual by definition: this is the endpoint the user
   * types into.
   */
  private static build(
    attributes: NewMovement,
    existing: Nullable<Movement>,
  ): Movement {
    if (!existing) return Movement.manual(attributes);

    existing.update(attributes);

    return existing;
  }
}
