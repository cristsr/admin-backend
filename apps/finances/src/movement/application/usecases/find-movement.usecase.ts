import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import {
  Movement,
  MovementCriteria,
  MovementRepository,
} from '@app/movement/domain/movement';

@Injectable()
export class FindMovementUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(id: number, user: number): Promise<Nullable<Movement>> {
    return this.movementRepository.firstMatching(
      MovementCriteria.byIdAndUser(id, user),
    );
  }
}
