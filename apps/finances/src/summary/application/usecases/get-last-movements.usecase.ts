import { Injectable } from '@nestjs/common';
import { Movement } from '../../../movement/domain/movement';
import { SummaryRepository } from '../../domain/summary';
import { LastMovementFilterDto } from '../dto/last-movement-filter.dto';

@Injectable()
export class GetLastMovementsUsecase {
  constructor(private readonly summaryRepository: SummaryRepository) {}

  async execute(filter: LastMovementFilterDto): Promise<Movement[]> {
    return this.summaryRepository.lastMovements(filter);
  }
}
