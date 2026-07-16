import { Injectable } from '@nestjs/common';
import { ScheduledRepository } from '../../domain/scheduled';

@Injectable()
export class RemoveScheduledUsecase {
  constructor(private readonly scheduledRepository: ScheduledRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    return this.scheduledRepository.remove(id, user);
  }
}
