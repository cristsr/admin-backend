import { Controller, NotFoundException } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { Observable, defer, map, of, switchMap, tap } from 'rxjs';
import { Account, AccountFilter, AccountInput, Id } from '@admin-back/core';
import { AccountRepository } from 'app/account/repositories';

@Controller()
export class AccountController {
  constructor(private accountRepository: AccountRepository) {}

  @MessagePattern()
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

  @MessagePattern()
  findOne({ id }: Id): Observable<Account> {
    return defer(() =>
      this.accountRepository.findOne({
        where: {
          id,
        },
      })
    );
  }

  @MessagePattern()
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
