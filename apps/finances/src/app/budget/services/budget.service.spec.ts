import { Test, TestingModule } from '@nestjs/testing';
import { BudgetHandler } from 'app/budget/handlers';
import { BudgetService } from './budget.service';

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
