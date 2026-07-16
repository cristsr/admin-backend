import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccountNotFoundException, AccountRepository } from '../../../account/domain/account';
import { CategoryNotFoundException, CategoryRepository } from '../../../category/domain/category';
import { SubcategoryNotFoundException, SubcategoryRepository } from '../../../category/domain/subcategory';
import { Movement, MovementNotFoundException, MovementRepository } from '../../domain/movement';
import { MovementInputDto } from '../dto/movement-input.dto';
import { MovementSaved, MovementSavedPayload } from '../movement.constants';

@Injectable()
export class SaveMovementUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: MovementInputDto): Promise<Movement> {
    const [existing, category, subcategory, account] = await Promise.all([
      input.id
        ? this.movementRepository.findByIdAndUser(input.id, input.user)
        : null,
      this.categoryRepository.findById(input.category),
      this.subcategoryRepository.findByIdAndCategory(
        input.subcategory,
        input.category,
      ),
      this.accountRepository.findByIdAndUser(input.account, input.user),
    ]);

    if (input.id && !existing) {
      throw new MovementNotFoundException('Movement not found');
    }

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    if (!subcategory) {
      throw new SubcategoryNotFoundException('Subcategory not found');
    }

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const movement = Movement.create({
      ...existing,
      date: input.date,
      type: input.type,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      accountId: account.id,
      user: input.user,
    } as Movement);

    const saved = await this.movementRepository.save(movement);

    this.eventEmitter.emit(MovementSaved, {
      categoryId: saved.categoryId,
      accountId: saved.accountId,
      date: saved.date,
      amount: saved.amount,
      user: saved.user,
    } as MovementSavedPayload);

    return saved;
  }
}
