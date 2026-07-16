import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../domain/category';

@Injectable()
export class RemoveCategoryUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number): Promise<boolean> {
    return this.categoryRepository.remove(id);
  }
}
