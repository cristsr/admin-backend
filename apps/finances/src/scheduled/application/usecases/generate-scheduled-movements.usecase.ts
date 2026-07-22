import { Injectable, Logger, Optional } from '@nestjs/common';
import { DateTime } from 'luxon';
import { correlationId, withSpan } from '@app/config/telemetry/correlation';
import { MovementRepository } from '@app/movement/domain/movement';
import {
  Scheduled,
  ScheduledLookups,
  ScheduledReports,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';

/** Materializes due scheduled entries into real movements, rolling each forward. */
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
    const due = await this.scheduledRepository.matching(ScheduledReports.due(DateTime.utc().toJSDate()));

    if (!due.length) return;

    // Own span per run: its id is the trace id all run log lines share.
    return withSpan('scheduled.generate', async () => {
      const runId = correlationId();
      this.logger.log(`Generating ${due.length} scheduled movement(s) correlationId=${runId}`);

      let materialized = 0;
      for (const schedule of due) {
        await this.materialize(schedule);
        materialized += 1;
      }

      this.logger.log(`scheduledCronDone scheduledMaterialized=${materialized} correlationId=${runId}`);
    });
  }

  /**
   * Saves the due occurrence's movement, then rolls the entry forward (or
   * removes a ONCE one). On save failure the entry is left untouched so the
   * occurrence is retried instead of skipped.
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
      await this.scheduledRepository.removeMatching(ScheduledLookups.byIdAndUser(schedule.id, schedule.user));
      return;
    }

    schedule.advance();
    await this.scheduledRepository.save(schedule);
  }
}
