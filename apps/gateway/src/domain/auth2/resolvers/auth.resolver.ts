import { Resolver, Query } from '@nestjs/graphql';
import { Auth } from 'domain/auth2/entities';
import { Public } from 'core/decorators';
import { UnauthorizedException } from '@nestjs/common';

@Resolver(() => Auth)
export class AuthResolver {
  // constructor(private readonly authService: AuthService) {}

  // @Mutation(() => Auth)
  // createAuth(@Args('createAuthInput') createAuthInput: CreateAuthInput) {
  //   return this.authService.create(createAuthInput);
  // }

  @Public()
  @Query(() => Auth)
  findAll() {
    throw new UnauthorizedException();

    const auth = new Auth();
    auth.email = 'fake@gmail.com';
    auth.password = 'fake';
    auth.type = 'local';

    return auth;
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
