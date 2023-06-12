import { Observable } from 'rxjs';
import { Id, AccountInput, Account, AccountFilter } from '../..';

export interface AccountGrpc {
  findAll(filter: AccountFilter): Observable<Account[]>;

  findOne(id: Id): Observable<Account>;

  save(account: AccountInput): Observable<Account>;
}
