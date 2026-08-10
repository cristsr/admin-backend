import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { NameCollisionException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { ReadModelAccountNameReader } from '@ledger/accounts/infrastructure/adapters/persistence/read-model-account-name-reader';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { AccountName } from '@ledger/shared/domain/value-objects';
import { AccountNameRegistry } from './account-name.registry';

/**
 * A registry over the real adapter and an in-memory store, not a fake: a
 * hand-written reader is free to filter differently than the adapter does,
 * and this registry is what stands between the rename rule and storage.
 */
async function registryWith(names: readonly string[]): Promise<AccountNameRegistry> {
  const store = new InMemoryReadModelStore();

  for (const [index, name] of names.entries()) {
    await store.upsert(
      PROJ_ACCOUNTS,
      { account_id: `acc-${index}` },
      {
        account_id: `acc-${index}`,
        user_id: 'user-1',
        type: 'ASSETS',
        name,
        parent_id: null,
        currency_code: null,
        opened_on: '2026-01-01',
        closed_on: null,
        is_bank_mirror: false,
        is_system: false,
      },
    );
  }

  return new AccountNameRegistry(new ReadModelAccountNameReader(store));
}
const name = (raw: string): AccountName => AccountName.of(raw);

describe('AccountNameRegistry', () => {
  describe('ensureAvailable (OpenAccount)', () => {
    it('accepts a name nobody holds', async () => {
      const registry = await registryWith(['Assets:Bank']);

      await expect(registry.ensureAvailable('user-1', name('Assets:Cash'))).resolves.toBeUndefined();
    });

    it('rejects a name already held with NAME_COLLISION', async () => {
      const registry = await registryWith(['Assets:Bank']);

      await expect(registry.ensureAvailable('user-1', name('Assets:Bank'))).rejects.toBeInstanceOf(
        NameCollisionException,
      );
    });

    it('asks about the names of the given user (INV-9)', async () => {
      const registry = await registryWith(['Assets:Bank']);

      await expect(
        registry.ensureAvailable('user-2', name('Assets:Bank')),
      ).resolves.toBeUndefined();
    });
  });

  describe('ensureRenameable (RenameAccount)', () => {
    it('accepts a rename to a free name', async () => {
      const registry = await registryWith(['Assets:Bank', 'Expenses:Food']);

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Savings')),
      ).resolves.toBeUndefined();
    });

    it('rejects a rename onto another account of the same user', async () => {
      const registry = await registryWith(['Assets:Bank', 'Assets:Cash']);

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Cash')),
      ).rejects.toBeInstanceOf(NameCollisionException);
    });

    it('accepts renaming an account to its own current name', async () => {
      const registry = await registryWith(['Assets:Bank', 'Assets:Bank:Savings']);

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Bank')),
      ).resolves.toBeUndefined();
    });

    it('accepts moving a subtree whose descendants land on free names', async () => {
      const registry = await registryWith(['Assets:Bank', 'Assets:Bank:Savings', 'Assets:Cash']);

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Bancolombia')),
      ).resolves.toBeUndefined();
    });

    it('rejects when a descendant would land on an existing name through propagation', async () => {
      // `Assets:Bank:Savings` already exists without `Assets:Bank` being its
      // parent row, so renaming `Assets:Cash` -> `Assets:Bank` would drag
      // `Assets:Cash:Savings` onto it.
      const registry = await registryWith(['Assets:Cash', 'Assets:Cash:Savings', 'Assets:Bank:Savings']);

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Cash'), name('Assets:Bank')),
      ).rejects.toBeInstanceOf(NameCollisionException);
    });

    it('leaves a re-rooting rename to the aggregate (INV-14)', async () => {
      const registry = await registryWith(['Assets:Bank']);

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Expenses:Bank')),
      ).resolves.toBeUndefined();
    });
  });
});
