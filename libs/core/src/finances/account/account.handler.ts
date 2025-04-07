import { Observable } from 'rxjs';
import {
  Account,
  AccountFilter,
  AccountInput,
  UserAccountFilter,
} from '../../';

export abstract class AccountHandler {
  abstract findAll(
    filter: AccountFilter,
  ): Promise<Account[]> | Observable<Account[]>;

  abstract findOne(
    filter: UserAccountFilter,
  ): Promise<Account> | Observable<Account>;

  abstract save(account: AccountInput): Observable<Account>;
}
