import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './account.service';
import { SummaryHandler } from 'app/summary/handler';

describe('SummaryController', () => {
  let controller: AccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountService],
      providers: [SummaryHandler],
    }).compile();

    controller = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
