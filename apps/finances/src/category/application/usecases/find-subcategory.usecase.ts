import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import {
  Subcategory,
  SubcategoryCriteria,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';

@Injectable()
export class FindSubcategoryUsecase {
  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async execute(id: number): Promise<Nullable<Subcategory>> {
    return this.subcategoryRepository.firstMatching(
      SubcategoryCriteria.byId(id),
    );
  }
}
