import { Injectable } from '@nestjs/common';
import { SubcategoryLookups, SubcategoryRepository } from '@app/category/domain/subcategory';

@Injectable()
export class RemoveSubcategoryUsecase {
  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async execute(id: number): Promise<boolean> {
    const removed = await this.subcategoryRepository.removeMatching(SubcategoryLookups.byId(id));

    return !!removed;
  }
}
