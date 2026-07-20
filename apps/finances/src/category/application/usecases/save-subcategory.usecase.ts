import { Injectable } from '@nestjs/common';
import {
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import {
  Subcategory,
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import { SubcategoryInputDto } from '../dto/subcategory-input.dto';

@Injectable()
export class SaveSubcategoryUsecase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
  ) {}

  async execute(input: SubcategoryInputDto): Promise<Subcategory> {
    const [existing, category] = await Promise.all([
      input.id ? this.subcategoryRepository.findById(input.id) : null,
      this.categoryRepository.findById(input.category),
    ]);

    if (input.id && !existing) {
      throw new SubcategoryNotFoundException('Subcategory not found');
    }

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    const subcategory = Subcategory.create({
      ...existing,
      name: input.name,
      categoryId: category.id,
    } as Subcategory);

    return this.subcategoryRepository.save(subcategory);
  }
}
