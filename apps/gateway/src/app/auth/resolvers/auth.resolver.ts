import { Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'core/decorators';
import { User } from 'app/shared/dto';

@Resolver()
export class AuthResolver {
  @Query(() => User)
  profile(@CurrentUser() user: User) {
    return user;
  }
}
