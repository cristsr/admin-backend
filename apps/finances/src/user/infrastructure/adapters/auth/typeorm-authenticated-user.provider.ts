import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser, AuthenticatedUserProvider } from '@shared';
import { UserRepository } from '@app/user/domain/user';

/**
 * Resolves the locally stored user for a verified token's external id. A token
 * whose subject has no matching user is treated as unauthenticated rather than
 * as a missing resource.
 */
@Injectable()
export class TypeOrmAuthenticatedUserProvider extends AuthenticatedUserProvider {
  constructor(private readonly userRepository: UserRepository) {
    super();
  }

  async findByExternalId(externalId: string): Promise<AuthenticatedUser> {
    const user = await this.userRepository.findByExternalId(externalId);
    if (!user) {
      throw new UnauthorizedException('No user matches the token subject');
    }

    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      externalId: user.externalId ?? externalId,
    };
  }
}
