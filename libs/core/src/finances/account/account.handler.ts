import { Observable } from 'rxjs';
import { Account, AccountFilter, AccountInput, Id } from '../../';

export abstract class AccountHandler {
  abstract findAll(filter: AccountFilter): Observable<Account[]>;

  abstract findOne(id: Id): Observable<Account>;

  abstract save(account: AccountInput): Observable<Account>;
}
