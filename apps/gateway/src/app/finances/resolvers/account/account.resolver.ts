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
  User,
} from '@admin-back/grpc';
import { Observable, pluck } from 'rxjs';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Account)
export class AccountResolver {
  @Inject(ACCOUNT_SERVICE)
  private accountService: AccountGrpc;

  @Query(() => [Account], { nullable: true })
  userAccounts(@CurrentUser() { id }: User): Observable<Account[]> {
    return this.accountService.findByUser({ id: 1 }).pipe(pluck('data'));
  }

  @Mutation(() => Account)
  createAccount(
    @CurrentUser() { id }: User,
    @Args('data') data: CreateAccount
  ): Observable<Account> {
    data.user = 1; // TODO fix here
    return this.accountService.create(data);
  }

  @ResolveField('balance')
  balance(@Parent() account: Account): Observable<Balance> {
    return this.accountService.findActiveBalance({ id: account.id });
  }
}
