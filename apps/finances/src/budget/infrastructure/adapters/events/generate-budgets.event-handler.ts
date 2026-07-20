import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GenerateBudgets } from '@app/budget/application/budget.constants';
import { GenerateBudgetsUsecase } from '@app/budget/application/usecases';

@Injectable()
export class GenerateBudgetsEventHandler {
  constructor(private readonly generateBudgetsUsecase: GenerateBudgetsUsecase) {}

  @OnEvent(GenerateBudgets)
  async handle(): Promise<void> {
    await this.generateBudgetsUsecase.execute();
  }
}
