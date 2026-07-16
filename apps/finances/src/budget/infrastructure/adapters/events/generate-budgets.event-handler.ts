import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GenerateBudgetsUsecase } from '../../../application/usecases';
import { GenerateBudgets } from '../../../application/budget.constants';

@Injectable()
export class GenerateBudgetsEventHandler {
  constructor(private readonly generateBudgetsUsecase: GenerateBudgetsUsecase) {}

  @OnEvent(GenerateBudgets)
  async handle(): Promise<void> {
    await this.generateBudgetsUsecase.execute();
  }
}
