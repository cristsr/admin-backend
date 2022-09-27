import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import {
  CreateUser,
  UpdateUser,
  User,
  USER_GRPC_CLIENT,
  USER_SERVICE,
  UserGrpc,
} from '@admin-back/grpc';
import { Inject } from '@nestjs/common';
import { Observable, pluck } from 'rxjs';

@Resolver(() => User)
export class UserResolver {
  @Inject(USER_SERVICE)
  private userService: UserGrpc;

  constructor(@Inject(USER_GRPC_CLIENT) private client) {
    console.log(client.grpcClients);
  }

  @Query(() => [User])
  users(): Observable<User[]> {
    return this.userService.findAll().pipe(pluck('data'));
  }

  @Query(() => User)
  user(@Args({ name: 'id', type: () => Int }) id: number) {
    return this.userService.findOne({ id });
  }

  @Mutation(() => User)
  createUser(@Args('user') user: CreateUser) {
    return this.userService.create(user);
  }

  @Mutation(() => User)
  updateUser(@Args('user') user: UpdateUser) {
    return this.userService.update(user);
  }

  @Mutation(() => User)
  removeUser(@Args('id', { type: () => Int }) id: number) {
    return this.userService.remove({ id });
  }
}
