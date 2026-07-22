import { Injectable } from '@nestjs/common';
import { UserRepository } from '@app/user/domain/user';
import { UserOutputDto } from '../dto';
import { UserMapper } from '../mappers';

@Injectable()
export class FindAllUsersUsecase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<UserOutputDto[]> {
    const users = await this.userRepository.findAll();
    return users.map(UserMapper.toOutput);
  }
}
