import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { ACCOUNT_HANDLER, AccountHandler, User } from '@admin-back/core';
import { CurrentUser } from '@admin-back/shared';
import {
  AccountFilterImp,
  AccountImp,
  AccountInputImp,
} from 'app/finances/account/dto';

@Resolver(AccountImp)
export class AccountResolver {
  constructor(
    @Inject(ACCOUNT_HANDLER)
    private accountHandler: AccountHandler
  ) {}

  @Query(() => AccountImp)
  accountById(
    @CurrentUser() user: User,
    @Args('id') id: number
  ): Observable<AccountImp> {
    return this.accountHandler.findOne({ id });
  }

  @Query(() => [AccountImp])
  userAccounts(
    @CurrentUser() user: User,
    @Args('filter') filter: AccountFilterImp
  ): Observable<AccountImp[]> {
    return this.accountHandler.findAll({
      ...filter,
      user: user.id,
    });
  }

  @Mutation(() => AccountImp)
  createAccount(
    @CurrentUser() user: User,
    @Args('account') account: AccountInputImp
  ): Observable<AccountImp> {
    return this.accountHandler.save({ ...account, user: user.id });
  }
}
