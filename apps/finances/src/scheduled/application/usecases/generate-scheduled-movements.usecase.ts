import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  Movement,
  MovementRepository,
  MovementSource,
} from '../../../movement/domain/movement';
import { Scheduled, ScheduledRepository } from '../../domain/scheduled';

/**
 * Materializes due `Scheduled` entries into real `Movement`s and rolls each one
 * to its next occurrence. Triggered every minute by `ScheduledScheduler`.
 */
@Injectable()
export class GenerateScheduledMovementsUsecase {
  #logger = new Logger(GenerateScheduledMovementsUsecase.name);

  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(): Promise<void> {
    const due = await this.scheduledRepository.findDue(DateTime.utc().toJSDate());

    if (!due.length) return;

    this.#logger.log(`Generating ${due.length} scheduled movement(s)`);

    for (const schedule of due) {
      await this.materialize(schedule);
    }
  }

  /**
   * Creates the movement for the occurrence that just came due, and only then
   * rolls the entry forward: a recurring one moves to its next date, a ONCE one
   * is done and gets removed. If the movement fails to save the entry is left
   * untouched, so the occurrence is retried instead of being silently skipped.
   */
  private async materialize(schedule: Scheduled): Promise<void> {
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
      source: MovementSource.SCHEDULED,
    } as Movement);

    try {
      await this.movementRepository.save(movement);
    } catch (error) {
      this.#logger.error(
        `Error creating movement for scheduled ${schedule.id}: ${error.message}`,
      );
      return;
    }

    if (!schedule.recurs()) {
      await this.scheduledRepository.remove(schedule.id, schedule.user);
      return;
    }

    schedule.advance();
    await this.scheduledRepository.save(schedule);
  }
}
