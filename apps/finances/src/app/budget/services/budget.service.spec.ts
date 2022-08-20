import { Test, TestingModule } from '@nestjs/testing';
import { BudgetService } from './budget.service';
import { BudgetHandler } from 'app/budget/handlers';

describe('BudgetController', () => {
  let controller: BudgetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BudgetService],
      providers: [BudgetHandler],
    }).compile();

    controller = module.get<BudgetService>(BudgetService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
