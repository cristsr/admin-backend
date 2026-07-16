import { Injectable } from '@nestjs/common';
import { AccountNotFoundException, AccountRepository } from '../../../account/domain/account';
import { CategoryNotFoundException, CategoryRepository } from '../../../category/domain/category';
import { SubcategoryNotFoundException, SubcategoryRepository } from '../../../category/domain/subcategory';
import { Movement, MovementRepository, MovementType } from '../../../movement/domain/movement';
import { WebhookTransactionInputDto } from '../dto/webhook-transaction-input.dto';
import { WebhookTransactionOutputDto } from '../dto/webhook-transaction-output.dto';

@Injectable()
export class ReceiveWebhookTransactionUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    input: WebhookTransactionInputDto,
  ): Promise<WebhookTransactionOutputDto> {
    const existing = await this.movementRepository.findByExternalReference(
      input.externalReference,
    );

    if (existing) {
      return {
        movementId: existing.id,
        externalReference: input.externalReference,
        duplicate: true,
      };
    }

    const category = await this.categoryRepository.findByName(input.category);

    if (!category) {
      throw new CategoryNotFoundException(
        `Category "${input.category}" not found`,
      );
    }

    const subcategory = input.subcategory
      ? await this.subcategoryRepository.findByNameAndCategory(
          input.subcategory,
          category.id,
        )
      : null;

    if (input.subcategory && !subcategory) {
      throw new SubcategoryNotFoundException(
        `Subcategory "${input.subcategory}" not found under category "${input.category}"`,
      );
    }

    const account = await this.accountRepository.findByIdAndUser(
      input.account,
      input.user,
    );

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const movement = Movement.create({
      date: input.date,
      type: input.type ?? MovementType.EXPENSE,
      description: input.merchant,
      amount: input.amount,
      currency: input.currency,
      categoryId: category.id,
      subcategoryId: subcategory?.id,
      accountId: account.id,
      user: input.user,
      externalReference: input.externalReference,
    } as Movement);

    const saved = await this.movementRepository.save(movement);

    return {
      movementId: saved.id,
      externalReference: input.externalReference,
      duplicate: false,
    };
  }
}
