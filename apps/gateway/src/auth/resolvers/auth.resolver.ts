import { Query, Resolver } from '@nestjs/graphql';
import { User } from '@core';
import { CurrentUser } from '@shared';
import { UserImp } from 'app/users/dto';

@Resolver(() => User)
export class AuthResolver {
  @Query(() => UserImp)
  profile(@CurrentUser() user: User) {
    return user;
  }
}
