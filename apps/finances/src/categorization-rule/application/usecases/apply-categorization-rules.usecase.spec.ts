import { CategoryNotFoundException } from '../../../category/domain/category';
import { CategorizationRule } from '../../domain/categorization-rule';
import { ApplyCategorizationRulesUsecase } from './apply-categorization-rules.usecase';

const rule = (over: Partial<CategorizationRule>): CategorizationRule =>
  CategorizationRule.create({
    id: 1,
    userId: 42,
    pattern: 'uber',
    categoryId: 10,
    priority: 0,
    ...over,
  } as CategorizationRule);

describe('ApplyCategorizationRulesUsecase (AC-4)', () => {
  let ruleRepository: any;
  let categoryRepository: any;
  let usecase: ApplyCategorizationRulesUsecase;

  beforeEach(() => {
    ruleRepository = { findByUserOrderByPriorityDesc: jest.fn() };
    categoryRepository = { findSystemDefault: jest.fn() };
    usecase = new ApplyCategorizationRulesUsecase(
      ruleRepository,
      categoryRepository,
    );
  });

  it('matches by case-insensitive substring on merchant', async () => {
    ruleRepository.findByUserOrderByPriorityDesc.mockResolvedValue([
      rule({ pattern: 'uber', categoryId: 10 }),
    ]);

    const result = await usecase.execute(
      { merchant: 'UBER TRIP 123', description: '' },
      42,
    );

    expect(result).toEqual({ categoryId: 10, subcategoryId: undefined });
  });

  it('matches on description when merchant does not', async () => {
    ruleRepository.findByUserOrderByPriorityDesc.mockResolvedValue([
      rule({ pattern: 'netflix', categoryId: 20 }),
    ]);

    const result = await usecase.execute(
      { merchant: '', description: 'NETFLIX.COM' },
      42,
    );

    expect(result.categoryId).toBe(20);
  });

  it('the highest-priority rule wins when several match', async () => {
    ruleRepository.findByUserOrderByPriorityDesc.mockResolvedValue([
      rule({ id: 1, pattern: 'a', categoryId: 99, priority: 10 }),
      rule({ id: 2, pattern: 'a', categoryId: 1, priority: 1 }),
    ]);

    const result = await usecase.execute({ merchant: 'aaa', description: '' }, 42);

    expect(result.categoryId).toBe(99);
  });

  it('falls back to the system default category when no rule matches', async () => {
    ruleRepository.findByUserOrderByPriorityDesc.mockResolvedValue([]);
    categoryRepository.findSystemDefault.mockResolvedValue({
      id: 7,
      name: 'Sin categorizar',
      system: true,
    });

    const result = await usecase.execute({ merchant: 'x', description: 'y' }, 42);

    expect(result.categoryId).toBe(7);
  });

  it('throws when the default category is missing', async () => {
    ruleRepository.findByUserOrderByPriorityDesc.mockResolvedValue([]);
    categoryRepository.findSystemDefault.mockResolvedValue(null);

    await expect(
      usecase.execute({ merchant: 'x', description: 'y' }, 42),
    ).rejects.toBeInstanceOf(CategoryNotFoundException);
  });
});
