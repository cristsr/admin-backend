import { Scheduled } from '../../domain/scheduled';
import { ScheduledOutputDto } from '../dto/scheduled-output.dto';

export class ScheduledMapper {
  static toOutput(scheduled: Scheduled): ScheduledOutputDto {
    return {
      id: scheduled.id,
      active: scheduled.active,
      createdAt: scheduled.createdAt,
      updatedAt: scheduled.updatedAt,
      date: scheduled.date,
      type: scheduled.type,
      description: scheduled.description,
      amount: scheduled.amount,
      currency: scheduled.currency,
      categoryId: scheduled.categoryId,
      subcategoryId: scheduled.subcategoryId,
      accountId: scheduled.accountId,
      repeat: scheduled.repeat,
      user: scheduled.user,
    };
  }
}
