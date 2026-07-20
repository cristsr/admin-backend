import { Account } from '@app/account/domain/account';
import { Money } from '@app/shared/domain';

export interface TransferCommand {
  from: Account;
  to: Account;
  amount: Money;
  date: Date;
  description?: string;
}
