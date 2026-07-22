import { Injectable } from '@nestjs/common';
import {
  SubcategoryLookups,
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import {
  Movement,
  MovementLookups,
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

  async execute(id: number, patch: MovementPatchDto, user: number): Promise<Movement> {
    const movement = await this.movementRepository.firstMatching(MovementLookups.byIdAndUser(id, user));
    if (!movement) {
      throw new MovementNotFoundException('Movement not found');
    }

    await this.ensureSubcategoryBelongsToCategory(patch, movement);

    // The entity itself refuses edits to transfer legs and ingestion-owned fields.
    movement.applyPatch(UpdateMovementUsecase.toDomainPatch(patch));

    return this.movementRepository.save(movement);
  }

  /** Validates the subcategory against the category the movement will end up with. */
  private async ensureSubcategoryBelongsToCategory(
    patch: MovementPatchDto,
    movement: Movement,
  ): Promise<void> {
    if (patch.subcategory === undefined) return;

    const categoryId = patch.category ?? movement.categoryId;
    const subcategory = await this.subcategoryRepository.firstMatching(
      SubcategoryLookups.byIdAndCategory(patch.subcategory, categoryId),
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
