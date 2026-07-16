import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenerateScheduledMovements } from '../../../application/scheduled.constants';

@Injectable()
export class ScheduledScheduler {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_MINUTE)
  generateMovements() {
    this.eventEmitter.emit(GenerateScheduledMovements);
  }
}
