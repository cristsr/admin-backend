import { Test, TestingModule } from '@nestjs/testing';
import { SummaryResolver } from './summary.resolver';

describe('SummaryResolver', () => {
  let resolver: SummaryResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SummaryResolver],
    }).compile();

    resolver = module.get<SummaryResolver>(SummaryResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
