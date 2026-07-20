import { Injectable } from '@nestjs/common';
import { normalizePagination } from '@shared';
import { Movement, MovementRepository } from '@app/movement/domain/movement';
import { MovementFilterDto } from '../dto/movement-filter.dto';

@Injectable()
export class FindAllMovementsUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(filter: MovementFilterDto, user: number): Promise<Movement[]> {
    const { take, skip } = normalizePagination(filter);
    return this.movementRepository.findAll({ ...filter, user, take, skip });
  }
}
