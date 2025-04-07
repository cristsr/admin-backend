import { Test, TestingModule } from '@nestjs/testing';
import { SummaryService } from './summary.service';

describe('SummaryController', () => {
  let controller: SummaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SummaryService],
    }).compile();

    controller = module.get<SummaryService>(SummaryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
