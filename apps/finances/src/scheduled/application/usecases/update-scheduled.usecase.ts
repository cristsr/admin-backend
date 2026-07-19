import { Injectable } from '@nestjs/common';
import {
  AccountNotFoundException,
  AccountRepository,
} from '../../../account/domain/account';
import {
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '../../../category/domain/subcategory';
import {
  Scheduled,
  ScheduledNotFoundException,
  ScheduledRepository,
} from '../../domain/scheduled';
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
    const scheduled = await this.scheduledRepository.findByIdAndUser(id, user);
    if (!scheduled) {
      throw new ScheduledNotFoundException('Scheduled not found');
    }

    if (patch.subcategory !== undefined) {
      const categoryId = patch.category ?? scheduled.categoryId;
      const subcategory =
        await this.subcategoryRepository.findByIdAndCategory(
          patch.subcategory,
          categoryId,
        );
      if (!subcategory) {
        throw new SubcategoryNotFoundException('Subcategory not found');
      }
    }

    if (patch.account !== undefined) {
      const account = await this.accountRepository.findByIdAndUser(
        patch.account,
        user,
      );
      if (!account) {
        throw new AccountNotFoundException('Account not found');
      }
    }

    scheduled.update({
      date: patch.date ?? scheduled.date,
      amount: patch.amount ?? scheduled.amount,
      frequency: patch.frequency ?? scheduled.frequency,
      description: patch.description ?? scheduled.description,
      categoryId: patch.category ?? scheduled.categoryId,
      subcategoryId: patch.subcategory ?? scheduled.subcategoryId,
      accountId: patch.account ?? scheduled.accountId,
    });

    return this.scheduledRepository.save(scheduled);
  }
}
