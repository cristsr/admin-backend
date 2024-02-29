import { Observable } from 'rxjs';
import { Account, AccountFilter, AccountInput, Id } from '../..';

export interface AccountGrpc {
  findAll(filter: AccountFilter): Observable<Account[]>;

  findOne(id: Id): Observable<Account>;

  save(account: AccountInput): Observable<Account>;
}
