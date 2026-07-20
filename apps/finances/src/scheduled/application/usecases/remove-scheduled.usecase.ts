import { Injectable } from '@nestjs/common';
import {
  ScheduledCriteria,
  ScheduledRepository,
} from '@app/scheduled/domain/scheduled';

@Injectable()
export class RemoveScheduledUsecase {
  constructor(private readonly scheduledRepository: ScheduledRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const removed = await this.scheduledRepository.removeMatching(
      ScheduledCriteria.byIdAndUser(id, user),
    );

    return !!removed;
  }
}
