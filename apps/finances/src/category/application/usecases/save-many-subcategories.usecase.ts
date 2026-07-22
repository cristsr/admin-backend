import { Injectable } from '@nestjs/common';
import { Subcategory, SubcategoryRepository } from '@app/category/domain/subcategory';
import { SubcategoriesInputDto } from '../dto/subcategories-input.dto';

@Injectable()
export class SaveManySubcategoriesUsecase {
  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async execute(input: SubcategoriesInputDto): Promise<boolean> {
    const subcategories = input.data.map((s) =>
      Subcategory.create({ name: s.name, categoryId: input.category } as Subcategory),
    );

    await this.subcategoryRepository.saveMany(subcategories);

    return true;
  }
}
