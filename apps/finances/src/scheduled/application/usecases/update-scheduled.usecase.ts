import { Injectable } from '@nestjs/common';
import {
  AccountCriteria,
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import {
  SubcategoryCriteria,
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import {
  Scheduled,
  ScheduledCriteria,
  ScheduledNotFoundException,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';
import { ScheduledPatchDto } from '../dto';

/**
 * Edits the template of a scheduled movement. Only affects future occurrences:
 * movements already materialized in the past are separate `movements` rows and
 * are not recomputed (AC-5).
 */
@Injectable()
export class UpdateScheduledUsecase {
  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    id: number,
    patch: ScheduledPatchDto,
    user: number,
  ): Promise<Scheduled> {
    const scheduled = await this.scheduledRepository.firstMatching(
      ScheduledCriteria.byIdAndUser(id, user),
    );
    if (!scheduled) {
      throw new ScheduledNotFoundException('Scheduled not found');
    }

    if (patch.subcategory !== undefined) {
      const categoryId = patch.category ?? scheduled.categoryId;
      const subcategory = await this.subcategoryRepository.firstMatching(
        SubcategoryCriteria.byIdAndCategory(patch.subcategory, categoryId),
      );
      if (!subcategory) {
        throw new SubcategoryNotFoundException('Subcategory not found');
      }
    }

    if (patch.account !== undefined) {
      const account = await this.accountRepository.firstMatching(
        AccountCriteria.byIdAndUser(patch.account, user),
      );
      if (!account) {
        throw new AccountNotFoundException('Account not found');
      }
    }

    scheduled.applyPatch({
      date: patch.date,
      amount: patch.amount,
      frequency: patch.frequency,
      description: patch.description,
      categoryId: patch.category,
      subcategoryId: patch.subcategory,
      accountId: patch.account,
    });

    return this.scheduledRepository.save(scheduled);
  }
}
