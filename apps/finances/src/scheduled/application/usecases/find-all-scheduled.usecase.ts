import { Injectable } from '@nestjs/common';
import { normalizePagination } from '@shared';
import {
  Scheduled,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';
import { ScheduledFilterDto } from '../dto/scheduled-filter.dto';

@Injectable()
export class FindAllScheduledUsecase {
  constructor(private readonly scheduledRepository: ScheduledRepository) {}

  async execute(filter: ScheduledFilterDto, user: number): Promise<Scheduled[]> {
    const { take, skip } = normalizePagination(filter);
    return this.scheduledRepository.findAll({ ...filter, user, take, skip });
  }
}
