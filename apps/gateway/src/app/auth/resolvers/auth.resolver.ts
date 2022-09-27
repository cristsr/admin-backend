import { Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@admin-back/shared';
import { User } from '@admin-back/grpc';

@Resolver()
export class AuthResolver {
  @Query(() => User)
  profile(@CurrentUser() user: User) {
    return user;
  }
}
