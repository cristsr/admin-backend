import { Test, TestingModule } from '@nestjs/testing';
import { SummaryHandler } from './summary.handler';

describe('SummaryService', () => {
  let service: SummaryHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SummaryHandler],
    }).compile();

    service = module.get<SummaryHandler>(SummaryHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
