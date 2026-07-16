import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Subcategory, SubcategoryRepository } from '../../domain/subcategory';

@Injectable()
export class FindSubcategoryUsecase {
  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async execute(id: number): Promise<Nullable<Subcategory>> {
    return this.subcategoryRepository.findById(id);
  }
}
