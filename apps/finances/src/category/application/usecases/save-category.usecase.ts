import { Injectable } from '@nestjs/common';
import {
  Category,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import {
  Subcategory,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import { CategoryInputDto } from '../dto/category-input.dto';

@Injectable()
export class SaveCategoryUsecase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
  ) {}

  async execute(input: CategoryInputDto): Promise<Category> {
    const existing = input.id
      ? await this.categoryRepository.findById(input.id)
      : null;

    if (input.id && !existing) {
      throw new CategoryNotFoundException('Category not found');
    }

    const category = existing
      ? Category.create({ ...existing, name: input.name, icon: input.icon, color: input.color })
      : Category.create({
          name: input.name,
          icon: input.icon,
          color: input.color,
        } as Category);

    const saved = await this.categoryRepository.save(category);

    if (input.id || !input.subcategories?.length) {
      return saved;
    }

    const subcategories = input.subcategories.map((s) =>
      Subcategory.create({ name: s.name, categoryId: saved.id } as Subcategory),
    );

    await this.subcategoryRepository.saveMany(subcategories);

    saved.subcategories = subcategories;

    return saved;
  }
}
