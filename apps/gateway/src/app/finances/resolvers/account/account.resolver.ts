import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  Account,
  ACCOUNT_SERVICE,
  AccountGrpc,
  Balance,
  CreateAccount,
  QueryBalance,
  User,
} from '@admin-back/grpc';
import { map, Observable } from 'rxjs';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Account)
export class AccountResolver {
  @Inject(ACCOUNT_SERVICE)
  private accountService: AccountGrpc;

  @Query(() => [Account])
  userAccounts(@CurrentUser() user: User): Observable<Account[]> {
    return this.accountService
      .findByUser({ id: user.id })
      .pipe(map((res) => res.data));
  }

  @Mutation(() => Account)
  createAccount(
    @CurrentUser() user: User,
    @Args('data') data: CreateAccount
  ): Observable<Account> {
    data.user = user.id;
    return this.accountService.create(data);
  }

  @ResolveField()
  balance(
    @CurrentUser() user: User,
    @Parent() account: Account,
    @Args('query') balance: QueryBalance
  ): Observable<Balance> {
    return this.accountService.findBalance({
      user: user.id,
      account: account.id,
      period: balance.period,
      date: balance.date,
    });
  }
}
