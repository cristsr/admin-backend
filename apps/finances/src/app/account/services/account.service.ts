import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { defer, map, Observable, of, switchMap, tap } from 'rxjs';
import { Account, AccountGrpc, AccountInput, Id } from '@admin-back/grpc';
import { AccountRepository } from 'app/account/repositories';
import { NotFoundException } from '@nestjs/common';

@GrpcService('finances')
export class AccountService implements AccountGrpc {
  constructor(private accountRepository: AccountRepository) {}

  @GrpcMethod()
  findAll(): Observable<Account[]> {
    return defer(() => this.accountRepository.find());
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
  findByUser(user: Id): Observable<Account[]> {
    return defer(() =>
      this.accountRepository.find({
        where: {
          user: user.id,
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
          closedAt: data.closed ? new Date() : null,
        })
      ),
      map((result) => new Account(result))
    );
  }
}
