import { Injectable } from '@nestjs/common';
import {
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '../../../category/domain/subcategory';
import {
  Movement,
  MovementNotEditableException,
  MovementNotFoundException,
  MovementRepository,
  MovementSource,
  MovementType,
} from '../../domain/movement';
import { MovementPatchDto } from '../dto';

/** Campos que un movimiento de ingesta (WEBHOOK) permite editar: solo lo que
 * es del usuario, nunca lo extraído por la ingesta. */
const WEBHOOK_EDITABLE = new Set([
  'notes',
  'category',
  'subcategory',
  'paymentMethod',
]);

const TRANSFER_TYPES = new Set<MovementType>([
  MovementType.TRANSFER_IN,
  MovementType.TRANSFER_OUT,
]);

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

    if (TRANSFER_TYPES.has(movement.type)) {
      throw new MovementNotEditableException(
        'Transfer legs cannot be edited; reverse the transfer instead',
      );
    }

    const touched = Object.keys(patch).filter(
      (key) => patch[key] !== undefined,
    );

    if (movement.source === MovementSource.WEBHOOK) {
      const forbidden = touched.filter((key) => !WEBHOOK_EDITABLE.has(key));
      if (forbidden.length) {
        throw new MovementNotEditableException(
          `Fields extracted by ingestion are read-only: ${forbidden.join(', ')}`,
        );
      }
    }

    if (patch.subcategory !== undefined) {
      const categoryId = patch.category ?? movement.categoryId;
      const subcategory =
        await this.subcategoryRepository.findByIdAndCategory(
          patch.subcategory,
          categoryId,
        );
      if (!subcategory) {
        throw new SubcategoryNotFoundException('Subcategory not found');
      }
    }

    movement.update({
      date: patch.date ?? movement.date,
      description: patch.description ?? movement.description,
      notes: patch.notes ?? movement.notes,
      amount: patch.amount ?? movement.amount,
      paymentMethod: patch.paymentMethod ?? movement.paymentMethod,
      categoryId: patch.category ?? movement.categoryId,
      subcategoryId: patch.subcategory ?? movement.subcategoryId,
    });

    return this.movementRepository.save(movement);
  }
}
