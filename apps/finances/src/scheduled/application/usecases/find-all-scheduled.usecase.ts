import { Injectable } from '@nestjs/common';
import { normalizePagination } from '@shared';
import { Scheduled, ScheduledRepository } from '../../domain/scheduled';
import { ScheduledFilterDto } from '../dto/scheduled-filter.dto';

@Injectable()
export class FindAllScheduledUsecase {
  constructor(private readonly scheduledRepository: ScheduledRepository) {}

  async execute(filter: ScheduledFilterDto): Promise<Scheduled[]> {
    const { take, skip } = normalizePagination(filter);
    return this.scheduledRepository.findAll({ ...filter, take, skip });
  }
}
