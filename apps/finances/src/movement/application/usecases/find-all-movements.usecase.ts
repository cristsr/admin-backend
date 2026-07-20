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

  /**
   * The query only ever narrows the listing: ownership is pinned by
   * `MovementCriteria.list`, so no filter a caller writes can reach another
   * user's movements.
   */
  async execute(query: CriteriaQueryDto, user: number): Promise<Movement[]> {
    return this.movementRepository.matching(MovementCriteria.list(query, user));
  }
}
