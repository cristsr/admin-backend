import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenerateScheduledMovements } from '@app/scheduled/application/scheduled.constants';

@Injectable()
export class ScheduledScheduler {
  private readonly logger = new Logger(ScheduledScheduler.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_MINUTE)
  generateMovements() {
    this.logger.log('scheduledCronFired');
    this.eventEmitter.emit(GenerateScheduledMovements);
  }
}
