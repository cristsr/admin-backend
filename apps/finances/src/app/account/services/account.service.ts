import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { from, Observable } from 'rxjs';
import { Repository } from 'typeorm';
import {
  Account,
  AccountGrpc,
  Accounts,
  Balance,
  CreateAccount,
  Empty,
  Id,
  QueryBalance,
  Status,
} from '@admin-back/grpc';
import { AccountEntity } from 'app/account/entities';
import { BalanceHandler } from 'app/account/handlers/balance.handler';

@GrpcService('finances')
export class AccountService implements AccountGrpc {
  constructor(
    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>,

    private balanceHandler: BalanceHandler
  ) {}

  @GrpcMethod()
  findAll(): Observable<Accounts> {
    const account$ = this.accountRepository
      .find({
        relations: ['balance'],
      })
      .then((data) => ({ data }));

    return from(account$);
  }

  @GrpcMethod()
  findOne({ id }: Id): Observable<Account> {
    const account$ = this.accountRepository.findOne({
      where: { id },
      relations: ['balance'],
    });

    return from(account$);
  }

  @GrpcMethod()
  findByUser(user: Id): Observable<Accounts> {
    const account$ = this.accountRepository
      .find({
        where: { user: user.id },
      })
      .then((data) => ({ data }));

    return from(account$);
  }

  @GrpcMethod()
  findBalance(query: QueryBalance): Observable<Balance> {
    return from(this.balanceHandler.findBalance(query));
  }

  @GrpcMethod()
  create(data: CreateAccount): Observable<Account> {
    const account$ = this.accountRepository.save({
      name: data.name,
      user: data.user,
      initialBalance: data.initialBalance,
    });

    return from(account$);
  }

  @GrpcMethod()
  update(empty: Empty): Observable<Account> {
    return undefined;
  }

  @GrpcMethod()
  remove(empty: Empty): Observable<Status> {
    return undefined;
  }
}
