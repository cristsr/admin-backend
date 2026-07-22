import { User } from '@app/user/domain/user';
import { UserOutputDto } from '../dto/user-output.dto';

export class UserMapper {
  static toOutput(user: User): UserOutputDto {
    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      auth0Id: user.externalId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
