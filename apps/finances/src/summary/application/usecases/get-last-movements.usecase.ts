import { Injectable } from '@nestjs/common';
import { Movement } from '@app/movement/domain/movement';
import { SummaryRepository } from '@app/summary/domain/summary';
import { LastMovementFilterDto } from '../dto/last-movement-filter.dto';

@Injectable()
export class GetLastMovementsUsecase {
  constructor(private readonly summaryRepository: SummaryRepository) {}

  async execute(filter: LastMovementFilterDto, user: number): Promise<Movement[]> {
    return this.summaryRepository.lastMovements({ ...filter, user });
  }
}
