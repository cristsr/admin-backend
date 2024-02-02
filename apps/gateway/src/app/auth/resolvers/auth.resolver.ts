import { Query, Resolver } from '@nestjs/graphql';
import { User } from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver()
export class AuthResolver {
  @Query(() => User)
  profile(@CurrentUser() user: User) {
    return user;
  }
}
