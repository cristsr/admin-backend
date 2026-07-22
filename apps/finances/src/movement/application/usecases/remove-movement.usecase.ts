import { Injectable } from '@nestjs/common';
import { MovementLookups, MovementRepository } from '@app/movement/domain/movement';

@Injectable()
export class RemoveMovementUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const removed = await this.movementRepository.removeMatching(MovementLookups.byIdAndUser(id, user));

    return !!removed;
  }
}
