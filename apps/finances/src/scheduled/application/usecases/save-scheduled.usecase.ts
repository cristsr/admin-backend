import { Injectable } from '@nestjs/common';
import { AccountNotFoundException, AccountRepository } from '../../../account/domain/account';
import { CategoryNotFoundException, CategoryRepository } from '../../../category/domain/category';
import { SubcategoryNotFoundException, SubcategoryRepository } from '../../../category/domain/subcategory';
import { Scheduled, ScheduledNotFoundException, ScheduledRepository } from '../../domain/scheduled';
import { ScheduledInputDto } from '../dto/scheduled-input.dto';

@Injectable()
export class SaveScheduledUsecase {
  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: ScheduledInputDto): Promise<Scheduled> {
    const [existing, category, subcategory, account] = await Promise.all([
      input.id
        ? this.scheduledRepository.findByIdAndUser(input.id, input.user)
        : null,
      this.categoryRepository.findById(input.category),
      this.subcategoryRepository.findByIdAndCategory(
        input.subcategory,
        input.category,
      ),
      this.accountRepository.findByIdAndUser(input.account, input.user),
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

    const scheduled = Scheduled.create({
      ...existing,
      date: input.date,
      type: input.type,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      repeat: input.repeat,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      accountId: account.id,
      user: input.user,
    } as Scheduled);

    return this.scheduledRepository.save(scheduled);
  }
}
