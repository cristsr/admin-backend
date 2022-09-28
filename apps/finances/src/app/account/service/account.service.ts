import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import {
  Account,
  AccountGrpc,
  Accounts,
  Balance,
  Balances,
  CreateAccount,
  Empty,
  Id,
  Status,
} from '@admin-back/grpc';
import { from, Observable, switchMap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountEntity, BalanceEntity } from 'app/account/entities';
import { Repository } from 'typeorm';

@GrpcService('finances')
export class AccountService implements AccountGrpc {
  constructor(
    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>,

    @InjectRepository(BalanceEntity)
    private balanceRepository: Repository<BalanceEntity>
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
  findActiveBalance(account: Id): Observable<Balance> {
    const balance$ = this.balanceRepository.findOne({
      where: {
        account: {
          id: account.id,
        },
        active: true,
      },
    });

    return from(balance$);
  }

  @GrpcMethod()
  create(data: CreateAccount): Observable<Account> {
    const account$ = this.accountRepository.save({
      name: data.name,
      user: data.user,
    });

    return from(account$).pipe(
      switchMap((account) => {
        return this.balanceRepository
          .save({
            balance: data.balance,
            account,
          })
          .then(() => account);
      })
    );
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
