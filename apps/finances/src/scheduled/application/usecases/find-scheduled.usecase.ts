import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import {
  Scheduled,
  ScheduledCriteria,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';

@Injectable()
export class FindScheduledUsecase {
  constructor(private readonly scheduledRepository: ScheduledRepository) {}

  async execute(id: number, user: number): Promise<Nullable<Scheduled>> {
    return this.scheduledRepository.firstMatching(
      ScheduledCriteria.byIdAndUser(id, user),
    );
  }
}
