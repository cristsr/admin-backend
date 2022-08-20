import { Test, TestingModule } from '@nestjs/testing';
import { BudgetHandler } from './budget.handler';

describe('BudgetService', () => {
  let service: BudgetHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetHandler],
    }).compile();

    service = module.get<BudgetHandler>(BudgetHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
