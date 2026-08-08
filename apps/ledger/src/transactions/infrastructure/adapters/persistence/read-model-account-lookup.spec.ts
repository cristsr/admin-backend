import { Nullable } from '@shared';
import {
  AccountFacts,
  AccountFactsReader,
} from '@ledger/accounts/application/ports/account-facts-reader.port';
import { ReadModelAccountLookup } from './read-model-account-lookup';

class FixedAccountFactsReader extends AccountFactsReader {
  readonly asked: { userId: string; accountId: string }[] = [];

  constructor(private readonly facts: Nullable<AccountFacts>) {
    super();
  }

  async factsOf(userId: string, accountId: string): Promise<Nullable<AccountFacts>> {
    this.asked.push({ userId, accountId });

    return this.facts;
  }
}

/**
 * The anti-corruption adapter: `transactions` asks through its own
 * `AccountLookup`, and only this class knows `accounts` answers it. What used to
 * be a direct `proj_accounts` query — which made another module's column names a
 * compile-time dependency of this one — is now a port call.
 */
describe('ReadModelAccountLookup', () => {
  it('resolves the facts through the accounts port, scoped to the user', async () => {
    const reader = new FixedAccountFactsReader({
      accountId: 'acc-1',
      type: 'ASSETS',
      currency: 'COP',
      isBankMirror: true,
    });

    const facts = await new ReadModelAccountLookup(reader).factsOf('user-1', 'acc-1');

    expect(facts).toEqual(
      expect.objectContaining({ accountId: 'acc-1', type: 'ASSETS', isBankMirror: true }),
    );
    expect(reader.asked).toEqual([{ userId: 'user-1', accountId: 'acc-1' }]);
  });

  /**
   * Transfer detection reads `isBankMirror`, which is why this port exists
   * instead of reusing `AccountConstraintsReader` — that one answers what a
   * posting is validated against, and this flag validates nothing.
   */
  it('carries isBankMirror through untouched', async () => {
    const reader = new FixedAccountFactsReader({
      accountId: 'acc-2',
      type: 'ASSETS',
      currency: null,
      isBankMirror: false,
    });

    const facts = await new ReadModelAccountLookup(reader).factsOf('user-1', 'acc-2');

    expect(facts?.isBankMirror).toBe(false);
    expect(facts?.currency).toBeNull();
  });

  /** A miss stays a miss: deciding what an unknown account means is the caller's business. */
  it('returns null when the account is unknown', async () => {
    const reader = new FixedAccountFactsReader(null);

    expect(await new ReadModelAccountLookup(reader).factsOf('user-1', 'missing')).toBeNull();
  });
});
