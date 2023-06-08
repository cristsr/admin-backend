import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  Account,
  ACCOUNT_SERVICE,
  AccountGrpc,
  AccountInput,
  User,
} from '@admin-back/grpc';
import { Observable } from 'rxjs';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Account)
export class AccountResolver {
  constructor(
    @Inject(ACCOUNT_SERVICE)
    private accountService: AccountGrpc
  ) {}

  @Query(() => [Account])
  userAccounts(@CurrentUser() user: User): Observable<Account[]> {
    return this.accountService.findByUser({ id: user.id });
  }

  @Mutation(() => Account)
  createAccount(
    @CurrentUser() user: User,
    @Args('account') account: AccountInput
  ): Observable<Account> {
    return this.accountService.save({ ...account, user: user.id });
  }
}
