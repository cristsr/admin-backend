import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './categoryService';
import { CategoryServiceImpl } from 'app/category/handlers';

describe('CategoryController', () => {
  let controller: CategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryService],
      providers: [CategoryServiceImpl],
    }).compile();

    controller = module.get<CategoryService>(CategoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
