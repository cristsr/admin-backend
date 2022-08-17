import { Test, TestingModule } from '@nestjs/testing';
import { SubcategoryService } from './subcategory.service';

describe('SubcategoryService', () => {
  let controller: SubcategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubcategoryService],
    }).compile();

    controller = module.get<SubcategoryService>(SubcategoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
