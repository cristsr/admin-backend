import { Injectable } from '@nestjs/common';
import { CriteriaQueryDto } from '@shared';
import {
  Scheduled,
  ScheduledCriteria,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';

@Injectable()
export class FindAllScheduledUsecase {
  constructor(private readonly scheduledRepository: ScheduledRepository) {}

  async execute(query: CriteriaQueryDto, user: number): Promise<Scheduled[]> {
    return this.scheduledRepository.matching(
      ScheduledCriteria.list(query, user),
    );
  }
}
