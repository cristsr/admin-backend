import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GenerateScheduledMovementsUsecase } from '../../../application/usecases';
import { GenerateScheduledMovements } from '../../../application/scheduled.constants';

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
