import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Movement, MovementRepository } from '../../../movement/domain/movement';
import { ScheduledRepository } from '../../domain/scheduled';

/**
 * Materializes due recurring `Scheduled` entries into real `Movement`s.
 * Triggered every minute by `ScheduledScheduler`.
 */
@Injectable()
export class GenerateScheduledMovementsUsecase {
  #logger = new Logger(GenerateScheduledMovementsUsecase.name);

  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(): Promise<void> {
    this.#logger.log('Generating movements');

    const utc = DateTime.utc();
    const due = await this.scheduledRepository.findDueAt(
      utc.startOf('minute').toJSDate(),
      utc.endOf('minute').toJSDate(),
    );

    for (const schedule of due) {
      const movement = Movement.create({
        description: schedule.description,
        amount: schedule.amount,
        currency: schedule.currency,
        type: schedule.type,
        date: schedule.date,
        categoryId: schedule.categoryId,
        subcategoryId: schedule.subcategoryId,
        accountId: schedule.accountId,
        user: schedule.user,
      } as Movement);

      await this.movementRepository.save(movement).catch((error) => {
        this.#logger.error(`Error creating movement ${error.message}`);
      });
    }

    this.#logger.log('Movements generated');
  }
}
