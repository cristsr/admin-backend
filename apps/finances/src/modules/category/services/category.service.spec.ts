import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  let controller: CategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryService],
    }).compile();

    controller = module.get<CategoryService>(CategoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
