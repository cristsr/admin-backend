import { Injectable } from '@nestjs/common';
import { UserNotFoundException, UserRepository } from '@app/user/domain/user';
import { UserOutputDto } from '../dto';
import { UserMapper } from '../mappers';

@Injectable()
export class FindUserUsecase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: number): Promise<UserOutputDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new UserNotFoundException(`User ${id} not found`);
    }

    return UserMapper.toOutput(user);
  }
}
