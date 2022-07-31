import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject, Logger } from '@nestjs/common';
import { Public } from 'core/decorators';
import { AuthService, RegisterType } from '@admin-back/shared';
import { AUTH_SERVICE } from 'app/auth/const';
import { LoginInput, LoginRes, RegisterInput } from 'app/auth/dto';
import { User } from 'app/shared/dto';

@Resolver()
export class AuthResolver {
  #logger = new Logger(AuthResolver.name);

  @Inject(AUTH_SERVICE)
  private authService: AuthService;

  @Public()
  @Mutation(() => User)
  register(@Args('data') data: RegisterInput) {
    this.#logger.debug(data);
    return this.authService.register(data);
  }

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

  // @Query(() => Auth, { name: 'auth' })
  // findOne(@Args('id', { type: () => Int }) id: number) {
  //   return this.authService.findOne(id);
  // }
  //
  // @Mutation(() => Auth)
  // updateAuth(@Args('updateAuthInput') updateAuthInput: UpdateAuthInput) {
  //   return this.authService.update(updateAuthInput.id, updateAuthInput);
  // }
  //
  // @Mutation(() => Auth)
  // removeAuth(@Args('id', { type: () => Int }) id: number) {
  //   return this.authService.remove(id);
  // }
  //
  // @ResolveField(() => String, { name: 'name', nullable: true })
  // exampleField(@Parent() auth: Auth) {
  //   return 'Cristian pro';
  // }
}
