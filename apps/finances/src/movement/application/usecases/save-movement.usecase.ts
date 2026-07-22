import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { AccountLookups, AccountNotFoundException, AccountRepository } from '@app/account/domain/account';
import { CategoryResolver } from '@app/categorization-rule/domain/categorization-rule';
import {
  Movement,
  MovementLookups,
  MovementNotFoundException,
  MovementRepository,
  NewMovement,
} from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { MovementInputDto } from '../dto/movement-input.dto';
import { RecordMovementService } from '../services';

@Injectable()
export class SaveMovementUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryResolver: CategoryResolver,
    private readonly recordMovement: RecordMovementService,
  ) {}

  async execute(input: MovementInputDto, user: number, requestId?: string): Promise<Movement> {
    const [existing, account] = await Promise.all([
      input.id ? this.movementRepository.firstMatching(MovementLookups.byIdAndUser(input.id, user)) : null,
      this.accountRepository.firstMatching(AccountLookups.byIdAndUser(input.account, user)),
    ]);

    if (input.id && !existing) {
      throw new MovementNotFoundException('Movement not found');
    }

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const { categoryId, subcategoryId } = await this.categoryResolver.resolveByIds(
      { categoryId: input.category, subcategoryId: input.subcategory },
      { description: input.description },
      user,
    );

    // Must be read before `build` overwrites the existing movement.
    const replacedBalanceEffect = existing?.signedAmount() ?? 0;

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

    return this.recordMovement.record(movement, account, {
      requestId,
      replacedBalanceEffect,
    });
  }

  /** Re-saving keeps the original source; only a new movement is manual. */
  private static build(attributes: NewMovement, existing: Nullable<Movement>): Movement {
    if (!existing) return Movement.manual(attributes);

    existing.update(attributes);

    return existing;
  }
}
