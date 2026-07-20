import { Injectable } from '@nestjs/common';
import { CriteriaQueryDto } from '@shared';
import {
  Movement,
  MovementCriteria,
  MovementRepository,
} from '@app/movement/domain/movement';

@Injectable()
export class FindAllMovementsUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  /** Ownership is pinned by `MovementCriteria.list`; query filters only narrow it. */
  async execute(query: CriteriaQueryDto, user: number): Promise<Movement[]> {
    return this.movementRepository.matching(MovementCriteria.list(query, user));
  }
}
