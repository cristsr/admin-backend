import { Injectable } from '@nestjs/common';
import { AccountNotFoundException, AccountRepository } from '../../../account/domain/account';
import { ApplyCategorizationRulesUsecase } from '../../../categorization-rule/application/usecases';
import { CategoryNotFoundException, CategoryRepository } from '../../../category/domain/category';
import { SubcategoryNotFoundException, SubcategoryRepository } from '../../../category/domain/subcategory';
import { DomainEventOutboxPublisher } from '../../../outbox/application/services/domain-event-outbox.publisher';
import { Movement, MovementNotFoundException, MovementRepository, MovementSource } from '../../domain/movement';
import { MovementInputDto } from '../dto/movement-input.dto';
import { MovementSaved, MovementSavedPayload } from '../movement.constants';

@Injectable()
export class SaveMovementUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly outboxPublisher: DomainEventOutboxPublisher,
    private readonly applyCategorizationRules: ApplyCategorizationRulesUsecase,
  ) {}

  async execute(input: MovementInputDto, user: number): Promise<Movement> {
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

    const { categoryId, subcategoryId } = await this.resolveCategory(
      input,
      user,
    );

    const movement = Movement.create({
      ...existing,
      date: input.date,
      type: input.type,
      description: input.description,
      notes: input.notes,
      amount: input.amount,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      source: existing?.source ?? MovementSource.MANUAL,
      categoryId,
      subcategoryId,
      accountId: account.id,
      user,
    } as Movement);

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
          amount: saved.amount,
          user: saved.user,
        } as MovementSavedPayload,
      });

      return saved;
    });
  }

  /**
   * AC-4: when a category is given, validate it (and its subcategory); when it
   * is omitted, resolve it from the user's categorization rules, falling back to
   * the default "Sin categorizar".
   */
  private async resolveCategory(
    input: MovementInputDto,
    user: number,
  ): Promise<{ categoryId: number; subcategoryId?: number }> {
    if (!input.category) {
      return this.applyCategorizationRules.execute(
        { description: input.description },
        user,
      );
    }

    const [category, subcategory] = await Promise.all([
      this.categoryRepository.findById(input.category),
      input.subcategory
        ? this.subcategoryRepository.findByIdAndCategory(
            input.subcategory,
            input.category,
          )
        : null,
    ]);

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    if (input.subcategory && !subcategory) {
      throw new SubcategoryNotFoundException('Subcategory not found');
    }

    return { categoryId: category.id, subcategoryId: subcategory?.id };
  }
}
