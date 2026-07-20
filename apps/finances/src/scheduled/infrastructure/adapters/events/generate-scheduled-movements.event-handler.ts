import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GenerateScheduledMovements } from '@app/scheduled/application/scheduled.constants';
import { GenerateScheduledMovementsUsecase } from '@app/scheduled/application/usecases';

@Injectable()
export class GenerateScheduledMovementsEventHandler {
  constructor(
    private readonly generateScheduledMovementsUsecase: GenerateScheduledMovementsUsecase,
  ) {}

  @OnEvent(GenerateScheduledMovements)
  async handle(): Promise<void> {
    await this.generateScheduledMovementsUsecase.execute();
  }
}
