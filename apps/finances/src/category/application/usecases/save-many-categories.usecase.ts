import { Injectable, Logger } from '@nestjs/common';
import { Category, CategoryRepository } from '../../domain/category';
import { Subcategory } from '../../domain/subcategory';
import { CategoriesInputDto } from '../dto/categories-input.dto';

@Injectable()
export class SaveManyCategoriesUsecase {
  #logger = new Logger(SaveManyCategoriesUsecase.name);

  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: CategoriesInputDto): Promise<boolean> {
    const categories = input.data.map((c) =>
      Category.create({
        name: c.name,
        icon: c.icon,
        color: c.color,
        subcategories: c.subcategories?.map((s) =>
          Subcategory.create({ name: s.name } as Subcategory),
        ),
      } as Category),
    );

    try {
      await this.categoryRepository.saveMany(categories);
      return true;
    } catch (error) {
      this.#logger.error(`Failed to save categories batch: ${error.message}`);
      return false;
    }
  }
}
