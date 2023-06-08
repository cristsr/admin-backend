import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { defer, Observable } from 'rxjs';
import { Account, AccountGrpc, AccountInput, Id } from '@admin-back/grpc';
import { AccountRepository } from 'app/account/repositories';

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
    return defer(() =>
      this.accountRepository.save({
        name: data.name,
        user: data.user,
        initialBalance: data.initialBalance,
      })
    );
  }
}
