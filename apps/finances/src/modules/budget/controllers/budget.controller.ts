import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Budget,
  BudgetFilter,
  BudgetInput,
  GenerateBudgets,
  Status,
  User,
} from '@core';
import { CurrentUser } from '@shared';
import { Observable } from 'rxjs';
import { BudgetService } from 'app/modules/budget/services';

@Controller('budgets')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: number) {
    return this.budgetService.findOne({
      budget: id,
      user: user.id,
    });
  }

  @Get()
  findAll(@Body() filter: BudgetFilter) {
    return this.budgetService.findAll(filter);
  }

  @Get(':id/movements')
  findMovements(@CurrentUser() user: User, @Param('id') id: number) {
    return this.budgetService.findMovements({ id, user: user.id });
  }

  @Post()
  save(@Body() data: BudgetInput): Observable<Budget> {
    return this.budgetService.save(data);
  }

  @Delete(':id')
  remove(@Param('id') id: number): Observable<Status> {
    return this.budgetService.remove({ id });
  }

  @OnEvent(GenerateBudgets)
  async generateBudgets(): Promise<void> {
    await this.budgetService.generateBudgets();
  }
}
