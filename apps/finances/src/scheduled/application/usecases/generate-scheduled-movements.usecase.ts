import { Injectable, Logger, Optional } from '@nestjs/common';
import { DateTime } from 'luxon';
import { correlationId, withSpan } from '@app/config/telemetry/correlation';
import { MovementRepository } from '@app/movement/domain/movement';
import {
  Scheduled,
  ScheduledCriteria,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';

/**
 * Materializes due `Scheduled` entries into real `Movement`s and rolls each one
 * to its next occurrence. Triggered every minute by `ScheduledScheduler`. AC-4
 * (sm-0004): each run logs a structured counters line keyed by a per-run
 * correlation id.
 */
@Injectable()
export class GenerateScheduledMovementsUsecase {
  private readonly logger: Logger;

  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly movementRepository: MovementRepository,
    @Optional() logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(GenerateScheduledMovementsUsecase.name);
  }

  async execute(): Promise<void> {
    const due = await this.scheduledRepository.matching(
      ScheduledCriteria.due(DateTime.utc().toJSDate()),
    );

    if (!due.length) return;

    // The run gets its own span, so the id below is the trace id every log line
    // and every downstream call in this run already shares.
    return withSpan('scheduled.generate', async () => {
      const runId = correlationId();
      this.logger.log(
        `Generating ${due.length} scheduled movement(s) correlationId=${runId}`,
      );

      let materialized = 0;
      for (const schedule of due) {
        await this.materialize(schedule);
        materialized += 1;
      }

      this.logger.log(
        `scheduledCronDone scheduledMaterialized=${materialized} correlationId=${runId}`,
      );
    });
  }

  /**
   * Creates the movement for the occurrence that just came due, and only then
   * rolls the entry forward: a recurring one moves to its next date, a ONCE one
   * is done and gets removed. If the movement fails to save the entry is left
   * untouched, so the occurrence is retried instead of being silently skipped.
   */
  private async materialize(schedule: Scheduled): Promise<void> {
    try {
      await this.movementRepository.save(schedule.materialize());
    } catch (error) {
      this.logger.error(
        `Error creating movement for scheduled ${schedule.id} correlationId=${correlationId()}: ${error.message}`,
      );
      return;
    }

    if (!schedule.recurs()) {
      await this.scheduledRepository.removeMatching(
        ScheduledCriteria.byIdAndUser(schedule.id, schedule.user),
      );
      return;
    }

    schedule.advance();
    await this.scheduledRepository.save(schedule);
  }
}
