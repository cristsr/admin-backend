import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Account,
  AccountFilter,
  AccountHandler,
  AccountInput,
  Id,
} from '@core';
import { Observable, defer, map, of, switchMap, tap } from 'rxjs';
import { AccountRepository } from 'app/account/repositories';

@Injectable()
export class AccountService implements AccountHandler {
  constructor(private accountRepository: AccountRepository) {}

  findAll(filter: AccountFilter): Observable<Account[]> {
    return defer(() =>
      this.accountRepository.find({
        where: {
          active: filter.active,
          user: filter.user,
        },
      })
    );
  }

  findOne({ id }: Id): Observable<Account> {
    return defer(() =>
      this.accountRepository.findOne({
        where: {
          id,
        },
      })
    );
  }

  save(data: AccountInput): Observable<Account> {
    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.id,
          user: data.user,
        },
      })
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
        })
      ),
      map((result) => new Account(result))
    );
  }
}
