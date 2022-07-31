import { Resolver, Query, Args } from '@nestjs/graphql';
import { Public } from 'core/decorators';
import { Login2Req, LoginRes } from 'app/auth2/dto';
import { Inject, Logger } from '@nestjs/common';
import { AUTH_SERVICE } from 'app/auth/const';
import { AuthService } from '@admin-back/shared';

@Resolver()
export class AuthResolver {
  #logger = new Logger(AuthResolver.name);

  @Inject(AUTH_SERVICE)
  private authService: AuthService;

  // @Mutation(() => Auth)
  // createAuth(@Args('createAuthInput') createAuthInput: CreateAuthInput) {
  //   return this.authService.create(createAuthInput);
  // }

  @Public()
  @Query(() => LoginRes)
  login(@Args('data') data: Login2Req) {
    this.#logger.debug(data);

    return this.authService.login({
      email: data.email,
      password: data.password,
      type: 'local',
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
