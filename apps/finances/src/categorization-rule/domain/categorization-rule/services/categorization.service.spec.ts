import { CategoryNotFoundException } from '@app/category/domain/category';
import { CategorizationRule } from '../entities/categorization-rule.entity';
import { CategorizationService } from './categorization.service';

const buildRule = (overrides: Partial<CategorizationRule> = {}) =>
  CategorizationRule.create({
    id: 1,
    userId: 7,
    pattern: 'uber',
    categoryId: 10,
    priority: 1,
    ...overrides,
  } as CategorizationRule);

describe('CategorizationService', () => {
  let ruleRepository: any;
  let categoryRepository: any;
  let service: CategorizationService;

  beforeEach(() => {
    ruleRepository = { matching: jest.fn() };
    categoryRepository = { firstMatching: jest.fn() };
    service = new CategorizationService(ruleRepository, categoryRepository);
  });

  it('matches the pattern case-insensitively against the merchant', async () => {
    ruleRepository.matching.mockResolvedValue([buildRule({ subcategoryId: 20 })]);

    const result = await service.categorize({ merchant: 'UBER TRIP' }, 7);

    expect(result).toEqual({ categoryId: 10, subcategoryId: 20 });
  });

  it('also matches against the description', async () => {
    ruleRepository.matching.mockResolvedValue([buildRule()]);

    const result = await service.categorize({ description: 'Uber to the airport' }, 7);

    expect(result.categoryId).toBe(10);
  });

  it('the first rule wins, since the repository orders by priority', async () => {
    ruleRepository.matching.mockResolvedValue([
      buildRule({ id: 1, pattern: 'uber', categoryId: 10, priority: 5 }),
      buildRule({ id: 2, pattern: 'uber', categoryId: 99, priority: 1 }),
    ]);

    const result = await service.categorize({ merchant: 'UBER TRIP' }, 7);

    expect(result.categoryId).toBe(10);
  });

  it('falls back to the system default when no rule matches', async () => {
    ruleRepository.matching.mockResolvedValue([buildRule({ pattern: 'netflix' })]);
    categoryRepository.firstMatching.mockResolvedValue({ id: 1 });

    const result = await service.categorize({ merchant: 'UBER TRIP' }, 7);

    expect(result).toEqual({ categoryId: 1 });
  });

  it('fails loudly when the default category is missing', async () => {
    ruleRepository.matching.mockResolvedValue([]);
    categoryRepository.firstMatching.mockResolvedValue(null);

    await expect(service.categorize({ merchant: 'X' }, 7)).rejects.toThrow(CategoryNotFoundException);
  });
});
