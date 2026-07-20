import { Injectable } from '@nestjs/common';
import {
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import {
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import {
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import {
  Scheduled,
  ScheduledNotFoundException,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';
import { Money } from '@app/shared/domain';
import { ScheduledInputDto } from '../dto/scheduled-input.dto';

@Injectable()
export class SaveScheduledUsecase {
  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: ScheduledInputDto, user: number): Promise<Scheduled> {
    const [existing, category, subcategory, account] = await Promise.all([
      input.id
        ? this.scheduledRepository.findByIdAndUser(input.id, user)
        : null,
      this.categoryRepository.findById(input.category),
      this.subcategoryRepository.findByIdAndCategory(
        input.subcategory,
        input.category,
      ),
      this.accountRepository.findByIdAndUser(input.account, user),
    ]);

    if (input.id && !existing) {
      throw new ScheduledNotFoundException('Scheduled not found');
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

    const attributes = {
      date: input.date,
      type: input.type,
      description: input.description,
      money: Money.of(input.amount, input.currency),
      frequency: input.frequency,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      accountId: account.id,
      user,
    };

    const scheduled = existing ?? Scheduled.schedule(attributes);
    existing?.update(attributes);

    return this.scheduledRepository.save(scheduled);
  }
}
