import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '@core';
import { CurrentUser } from '@shared';
import { Observable, map } from 'rxjs';
import {
  AccountFilterImp,
  AccountImp,
  AccountInputImp,
} from 'app/modules/finances/account/dto';
import { FINANCES_API } from 'app/modules/finances/constants';

@Resolver(AccountImp)
export class AccountResolver {
  constructor(
    @Inject(FINANCES_API)
    private http: HttpService,
  ) {}

  @Query(() => AccountImp)
  accountById(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<AccountImp> {
    return this.http
      .get(`/accounts`, {
        params: {
          account: id,
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Query(() => [AccountImp])
  userAccounts(
    @CurrentUser() user: User,
    @Args('filter') filter: AccountFilterImp,
  ): Observable<AccountImp[]> {
    return this.http
      .get(`/accounts/query`, {
        params: {
          ...filter,
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Mutation(() => AccountImp)
  createAccount(
    @CurrentUser() user: User,
    @Args('account') account: AccountInputImp,
  ): Observable<AccountImp> {
    return this.http
      .post(`/accounts`, {
        ...account,
        user: user.id,
      })
      .pipe(map((response) => response.data));
  }
}
