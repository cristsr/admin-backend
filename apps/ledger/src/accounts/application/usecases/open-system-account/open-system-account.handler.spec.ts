import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { IdGenerator } from '@cqrs/domain/ports';
import { AccountRepository } from '@ledger/accounts/application/repositories/account.repository';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import { CurrencyCode } from '@ledger/shared/domain/value-objects';
import { OpenSystemAccountCommand } from './open-system-account.command';
import { OpenSystemAccountHandler } from './open-system-account.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const saved: Account[] = [];
  const accounts = {
    save: jest.fn(async (account: Account) => {
      saved.push(account);

      return { events: [], version: 1, lastPosition: 42n };
    }),
  } as unknown as jest.Mocked<AccountRepository>;

  const idGenerator: jest.Mocked<IdGenerator> = { next: jest.fn().mockReturnValue('acc-sys-1') };

  return { handler: new OpenSystemAccountHandler(accounts, idGenerator), accounts, saved };
}

describe('OpenSystemAccountHandler', () => {
  /**
   * INV-13 lives in this flag. Without it the technical accounts are ordinary
   * ones, and `AccountValidationService` would let any authenticated caller post
   * straight against `Equity:OpeningBalances` — manufacturing balance from
   * nothing.
   */
  it('opens the account as a system account', async () => {
    const { handler, saved } = setup();

    await handler.execute(
      new OpenSystemAccountCommand('Equity:OpeningBalances', '2026-01-01'),
      ctx,
    );

    expect(saved).toHaveLength(1);
    expect(saved[0].isSystem).toBe(true);
    expect(saved[0].name.value).toBe('Equity:OpeningBalances');
  });

  /**
   * `InitializeLedger` needs the id back to point `LedgerSettings` at it, and it
   * only gets what `CommandResult` carries — the bus never returns events
   * (rules Art. 10).
   */
  it('returns the account id and the append position', async () => {
    const { handler } = setup();

    const result = await handler.execute(
      new OpenSystemAccountCommand('Equity:Adjustments', '2026-01-01'),
      ctx,
    );

    expect(result.aggregateId).toBe('acc-sys-1');
    expect(result.streamPosition).toBe(42n);
    expect(result.idempotentReplay).toBe(false);
  });

  /**
   * A technical account books against whatever the counterparty uses, so it
   * accepts any currency (INV-4 does not restrict it). Asserted through the
   * rule itself rather than the field, which the aggregate keeps private.
   */
  it('accepts any currency', async () => {
    const { handler, saved } = setup();

    await handler.execute(new OpenSystemAccountCommand('Equity:Adjustments', '2026-01-01'), ctx);

    expect(() => saved[0].ensureAcceptsCurrency(CurrencyCode.of('COP'))).not.toThrow();
    expect(() => saved[0].ensureAcceptsCurrency(CurrencyCode.of('USD'))).not.toThrow();
  });
});
