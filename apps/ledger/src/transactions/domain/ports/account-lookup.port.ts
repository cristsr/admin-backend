import { Nullable } from '@shared';

/** Minimal account facts EP-3.7 needs from `proj_accounts` for transfer detection. */
export interface AccountFacts {
  readonly accountId: string;
  readonly type: string;
  readonly currency: Nullable<string>;
  readonly isBankMirror: boolean;
}

/** Reads account facts (type, currency, mirror flag) from `proj_accounts`. */
export abstract class AccountLookup {
  abstract factsOf(userId: string, accountId: string): Promise<Nullable<AccountFacts>>;
}
