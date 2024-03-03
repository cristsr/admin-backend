import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import {
  ACCOUNT_SERVICE,
  Account,
  AccountFilter,
  AccountGrpc,
  AccountInput,
  User,
} from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Account)
export class AccountResolver {
  constructor(
    @Inject(ACCOUNT_SERVICE)
    private accountService: AccountGrpc
  ) {}

  @Query(() => Account)
  accountById(
    @CurrentUser() user: User,
    @Args('id') id: number
  ): Observable<Account> {
    return this.accountService.findOne({ id });
  }

  @Query(() => [Account])
  userAccounts(
    @CurrentUser() user: User,
    @Args('filter') filter: AccountFilter
  ): Observable<Account[]> {
    return this.accountService.findAll({
      ...filter,
      user: user.id,
    });
  }

  @Mutation(() => Account)
  createAccount(
    @CurrentUser() user: User,
    @Args('account') account: AccountInput
  ): Observable<Account> {
    return this.accountService.save({ ...account, user: user.id });
  }
}
