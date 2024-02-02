import { NotFoundException } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { Observable, defer, map, of, switchMap, tap } from 'rxjs';
import {
  Account,
  AccountFilter,
  AccountGrpc,
  AccountInput,
  Id,
} from '@admin-back/grpc';
import { AccountRepository } from 'app/account/repositories';

@GrpcService('finances')
export class AccountService implements AccountGrpc {
  constructor(private accountRepository: AccountRepository) {}

  @GrpcMethod()
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

  @GrpcMethod()
  findOne({ id }: Id): Observable<Account> {
    return defer(() =>
      this.accountRepository.findOne({
        where: {
          id,
        },
      })
    );
  }

  @GrpcMethod()
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
