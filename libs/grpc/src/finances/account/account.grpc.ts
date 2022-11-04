import { Observable } from 'rxjs';
import {
  Empty,
  Id,
  AccountInput,
  Account,
  Accounts,
  Balance,
  BalanceFilter,
} from '@admin-back/grpc';

export interface AccountGrpc {
  findAll(empty: Empty): Observable<Accounts>;

  findOne(id: Id): Observable<Account>;

  findByUser(user: Id): Observable<Accounts>;

  save(account: AccountInput): Observable<Account>;

  findBalance(filter: BalanceFilter): Observable<Balance>;
}
