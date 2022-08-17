import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject, Logger } from '@nestjs/common';
import { CurrentUser, Public } from 'core/decorators';
import { AuthService, RegisterType } from '@admin-back/grpc';
import { AUTH_SERVICE } from 'app/auth/const';
import { LoginInput, LoginRes, RegisterInput } from 'app/auth/dto';
import { User } from 'app/shared/dto';

@Resolver()
export class AuthResolver {
  #logger = new Logger(AuthResolver.name);

  @Inject(AUTH_SERVICE)
  private authService: AuthService;

  @Public()
  @Query(() => LoginRes)
  login(@Args('data') data: LoginInput) {
    this.#logger.debug(data);
    return this.authService.login({
      email: data.email,
      password: data.password,
      type: RegisterType.Local,
    });
  }

  @Query(() => User)
  profile(@CurrentUser() user: User) {
    this.#logger.debug(user);
    return user;
  }

  @Public()
  @Mutation(() => User)
  register(@Args('data') data: RegisterInput) {
    this.#logger.debug(data);
    return this.authService.register(data);
  }
}
