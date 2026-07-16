import { Injectable } from '@nestjs/common';
import { SubcategoryRepository } from '../../domain/subcategory';

@Injectable()
export class RemoveSubcategoryUsecase {
  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async execute(id: number): Promise<boolean> {
    return this.subcategoryRepository.remove(id);
  }
}
