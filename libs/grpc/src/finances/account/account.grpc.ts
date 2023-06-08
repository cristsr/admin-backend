import { Observable } from 'rxjs';
import { Empty, Id, AccountInput, Account } from '../..';

export interface AccountGrpc {
  findAll(empty: Empty): Observable<Account[]>;

  findOne(id: Id): Observable<Account>;

  findByUser(user: Id): Observable<Account[]>;

  save(account: AccountInput): Observable<Account>;
}
