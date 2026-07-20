import { Injectable } from '@nestjs/common';
import {
  MovementCriteria,
  MovementRepository,
} from '@app/movement/domain/movement';

@Injectable()
export class RemoveMovementUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const removed = await this.movementRepository.removeMatching(
      MovementCriteria.byIdAndUser(id, user),
    );

    return !!removed;
  }
}
