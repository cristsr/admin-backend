import { Query, Resolver } from '@nestjs/graphql';
import { User } from '@core';
import { CurrentUser } from '@shared';

@Resolver(() => User)
export class AuthResolver {
  @Query(() => User)
  profile(@CurrentUser() user: User) {
    return user;
  }
}
