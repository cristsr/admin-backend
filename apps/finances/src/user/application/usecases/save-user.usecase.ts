import { Injectable } from '@nestjs/common';
import { User, UserAlreadyExistsException, UserRepository } from '@app/user/domain/user';
import { UserInputDto } from '../dto';

@Injectable()
export class SaveUserUsecase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: UserInputDto): Promise<User> {
    const externalId = input.auth0Id ?? null;
    const existing = await this.userRepository.findByEmailOrExternalId(input.email, externalId);

    if (existing) {
      throw new UserAlreadyExistsException('User is already registered');
    }

    const user = User.create({
      name: input.name,
      lastName: input.lastName,
      email: input.email,
      externalId,
    } as User);

    return this.userRepository.save(user);
  }
}
