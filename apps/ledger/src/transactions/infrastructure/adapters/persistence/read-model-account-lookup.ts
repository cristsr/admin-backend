import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { AccountFactsReader } from '@ledger/accounts/application/ports/account-facts-reader.port';
import {
  AccountFacts,
  AccountLookup,
} from '@ledger/transactions/application/ports/account-lookup.port';

/**
 * Anti-corruption adapter for {@link AccountLookup}: `transactions` states what
 * it needs through its own port, and this is the only class that knows another
 * module answers it.
 *
 * It used to query `proj_accounts` directly, which made the physical shape of an
 * `accounts` projection part of this module's compile-time surface — renaming a
 * column there broke a build here, with nothing declaring the contract.
 */
@Injectable()
export class ReadModelAccountLookup extends AccountLookup {
  constructor(private readonly accounts: AccountFactsReader) {
    super();
  }

  async factsOf(userId: string, accountId: string): Promise<Nullable<AccountFacts>> {
    return this.accounts.factsOf(userId, accountId);
  }
}
