import { Test, TestingModule } from '@nestjs/testing';
import { FinancesResolver } from './finances.resolver';
import { FinancesService } from '../services/finances.service';

describe('FinancesResolver', () => {
  let resolver: FinancesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancesResolver, FinancesService],
    }).compile();

    resolver = module.get<FinancesResolver>(FinancesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
