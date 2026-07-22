import { Injectable } from '@nestjs/common';
import { AccountLookups, AccountNotFoundException, AccountRepository } from '@app/account/domain/account';
import {
  SubcategoryLookups,
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import {
  Scheduled,
  ScheduledLookups,
  ScheduledNotFoundException,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';
import { ScheduledPatchDto } from '../dto';

/**
 * Edits the template of a scheduled movement; already-materialized movements
 * are not recomputed.
 */
@Injectable()
export class UpdateScheduledUsecase {
  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(id: number, patch: ScheduledPatchDto, user: number): Promise<Scheduled> {
    const scheduled = await this.scheduledRepository.firstMatching(ScheduledLookups.byIdAndUser(id, user));
    if (!scheduled) {
      throw new ScheduledNotFoundException('Scheduled not found');
    }

    if (patch.subcategory !== undefined) {
      const categoryId = patch.category ?? scheduled.categoryId;
      const subcategory = await this.subcategoryRepository.firstMatching(
        SubcategoryLookups.byIdAndCategory(patch.subcategory, categoryId),
      );
      if (!subcategory) {
        throw new SubcategoryNotFoundException('Subcategory not found');
      }
    }

    if (patch.account !== undefined) {
      const account = await this.accountRepository.firstMatching(
        AccountLookups.byIdAndUser(patch.account, user),
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
