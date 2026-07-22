import { Injectable } from '@nestjs/common';
import { UserRepository } from '@app/user/domain/user';
import { UserRemovedOutputDto } from '../dto';

@Injectable()
export class RemoveUserUsecase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: number): Promise<UserRemovedOutputDto> {
    const removed = await this.userRepository.remove(id);
    return { removed };
  }
}
