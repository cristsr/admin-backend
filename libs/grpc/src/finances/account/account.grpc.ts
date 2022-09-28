import { Observable } from 'rxjs';
import {
  Empty,
  Id,
  CreateAccount,
  Account,
  Accounts,
  Status,
  Balance,
} from '@admin-back/grpc';

export interface AccountGrpc {
  findAll(empty: Empty): Observable<Accounts>;

  findOne(id: Id): Observable<Account>;

  findByUser(user: Id): Observable<Accounts>;

  findActiveBalance(account: Id): Observable<Balance>;

  create(account: CreateAccount): Observable<Account>;

  update(empty: Empty): Observable<Account>;

  remove(empty: Empty): Observable<Status>;
}
