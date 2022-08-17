import { Test, TestingModule } from '@nestjs/testing';
import { SubcategoryResolver } from './subcategory.resolver';

describe('SubcategoryResolver', () => {
  let resolver: SubcategoryResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubcategoryResolver],
    }).compile();

    resolver = module.get<SubcategoryResolver>(SubcategoryResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
