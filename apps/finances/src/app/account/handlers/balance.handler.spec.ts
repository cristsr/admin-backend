import { Test, TestingModule } from '@nestjs/testing';
import { BalanceHandler } from './balance.handler';
import { SummaryHandler } from 'app/summary/handler';

describe('SummaryController', () => {
  let controller: BalanceHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceHandler],
      providers: [SummaryHandler],
    }).compile();

    controller = module.get<BalanceHandler>(BalanceHandler);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
