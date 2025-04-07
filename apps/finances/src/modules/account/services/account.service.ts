import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Account,
  AccountFilter,
  AccountHandler,
  AccountInput,
  UserAccountFilter,
} from '@core';
import { Observable, defer, map, of, switchMap, tap } from 'rxjs';
import { AccountRepository } from 'app/modules/account/repositories';

@Injectable()
export class AccountService implements AccountHandler {
  constructor(private accountRepository: AccountRepository) {}

  async findAll(filter: AccountFilter): Promise<Account[]> {
    return this.accountRepository.find({
      where: {
        active: filter.active,
        user: filter.user,
      },
    });
  }

  async findOne(filter: UserAccountFilter): Promise<Account> {
    return this.accountRepository.findOne({
      where: {
        id: filter.account,
        user: filter.user,
      },
    });
  }

  save(data: AccountInput): Observable<Account> {
    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.id,
          user: data.user,
        },
      }),
    );

    return (data.id ? account : of(null)).pipe(
      tap((account) => {
        if (data.id && !account) {
          throw new NotFoundException('Account not found');
        }
      }),
      switchMap((account) =>
        this.accountRepository.save({
          ...account,
          ...data,
        }),
      ),
      map((result) => new Account(result)),
    );
  }
}
