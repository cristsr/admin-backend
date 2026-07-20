import { Injectable } from '@nestjs/common';
import {
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import {
  Movement,
  MovementNotFoundException,
  MovementPatch,
  MovementRepository,
} from '@app/movement/domain/movement';
import { MovementPatchDto } from '../dto';

@Injectable()
export class UpdateMovementUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
  ) {}

  async execute(
    id: number,
    patch: MovementPatchDto,
    user: number,
  ): Promise<Movement> {
    const movement = await this.movementRepository.findByIdAndUser(id, user);
    if (!movement) {
      throw new MovementNotFoundException('Movement not found');
    }

    await this.ensureSubcategoryBelongsToCategory(patch, movement);

    // The movement decides what of this it accepts: transfer legs and
    // ingestion-owned fields refuse the edit.
    movement.applyPatch(UpdateMovementUsecase.toDomainPatch(patch));

    return this.movementRepository.save(movement);
  }

  /**
   * A subcategory only exists under a category, so it is validated against the
   * category the movement will end up with — the patched one when it changes.
   */
  private async ensureSubcategoryBelongsToCategory(
    patch: MovementPatchDto,
    movement: Movement,
  ): Promise<void> {
    if (patch.subcategory === undefined) return;

    const categoryId = patch.category ?? movement.categoryId;
    const subcategory = await this.subcategoryRepository.findByIdAndCategory(
      patch.subcategory,
      categoryId,
    );

    if (!subcategory) {
      throw new SubcategoryNotFoundException('Subcategory not found');
    }
  }

  /** The transport names the relations `category`/`subcategory`; the domain holds ids. */
  private static toDomainPatch(patch: MovementPatchDto): MovementPatch {
    return {
      date: patch.date,
      description: patch.description,
      notes: patch.notes,
      amount: patch.amount,
      paymentMethod: patch.paymentMethod,
      categoryId: patch.category,
      subcategoryId: patch.subcategory,
    };
  }
}
