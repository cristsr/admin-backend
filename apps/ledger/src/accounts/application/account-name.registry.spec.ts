import { Criteria } from '@shared';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { AccountName } from '@ledger/shared/domain/value-objects';
import { NameCollisionException } from '../domain/account/exceptions/account.exception';
import { AccountNameRegistry } from './account-name.registry';

/** A read model holding exactly the names the test declares, for one user. */
function storeWith(names: readonly string[]): jest.Mocked<ReadModelStore> {
  const rows = names.map((name, index) => ({ account_id: `acc-${index}`, name }));

  return {
    query: jest.fn(async (_table: string, criteria: Criteria) => {
      const byName = criteria.filters.find((filter) => filter.field === 'name');

      return byName ? rows.filter((row) => row.name === byName.value) : rows;
    }),
  } as unknown as jest.Mocked<ReadModelStore>;
}

const name = (raw: string): AccountName => AccountName.of(raw);

describe('AccountNameRegistry', () => {
  describe('ensureAvailable (OpenAccount)', () => {
    it('accepts a name nobody holds', async () => {
      const registry = new AccountNameRegistry(storeWith(['Assets:Bank']));

      await expect(registry.ensureAvailable('user-1', name('Assets:Cash'))).resolves.toBeUndefined();
    });

    it('rejects a name already held with NAME_COLLISION (§2.1.1)', async () => {
      const registry = new AccountNameRegistry(storeWith(['Assets:Bank']));

      await expect(registry.ensureAvailable('user-1', name('Assets:Bank'))).rejects.toBeInstanceOf(
        NameCollisionException,
      );
    });

    it('scopes the lookup to the user (INV-9)', async () => {
      const readModel = storeWith([]);
      const registry = new AccountNameRegistry(readModel);

      await registry.ensureAvailable('user-1', name('Assets:Bank'));

      const [, criteria] = readModel.query.mock.calls[0];
      expect((criteria as Criteria).filters).toContainEqual(
        expect.objectContaining({ field: 'user_id', value: 'user-1' }),
      );
    });
  });

  describe('ensureRenameable (RenameAccount)', () => {
    it('accepts a rename to a free name', async () => {
      const registry = new AccountNameRegistry(storeWith(['Assets:Bank', 'Expenses:Food']));

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Savings')),
      ).resolves.toBeUndefined();
    });

    it('rejects a rename onto another account of the same user (§2.1.1)', async () => {
      const registry = new AccountNameRegistry(storeWith(['Assets:Bank', 'Assets:Cash']));

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Cash')),
      ).rejects.toBeInstanceOf(NameCollisionException);
    });

    it('accepts renaming an account to its own current name', async () => {
      const registry = new AccountNameRegistry(storeWith(['Assets:Bank', 'Assets:Bank:Savings']));

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Bank')),
      ).resolves.toBeUndefined();
    });

    it('accepts moving a subtree whose descendants land on free names', async () => {
      const registry = new AccountNameRegistry(
        storeWith(['Assets:Bank', 'Assets:Bank:Savings', 'Assets:Cash']),
      );

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Assets:Bancolombia')),
      ).resolves.toBeUndefined();
    });

    it('rejects when a descendant would land on an existing name (§6.3 propagation)', async () => {
      // `Assets:Bank:Savings` already exists without `Assets:Bank` being its
      // parent row, so renaming `Assets:Cash` -> `Assets:Bank` would drag
      // `Assets:Cash:Savings` onto it.
      const registry = new AccountNameRegistry(
        storeWith(['Assets:Cash', 'Assets:Cash:Savings', 'Assets:Bank:Savings']),
      );

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Cash'), name('Assets:Bank')),
      ).rejects.toBeInstanceOf(NameCollisionException);
    });

    it('leaves a re-rooting rename to the aggregate (INV-14)', async () => {
      const registry = new AccountNameRegistry(storeWith(['Assets:Bank']));

      await expect(
        registry.ensureRenameable('user-1', name('Assets:Bank'), name('Expenses:Bank')),
      ).resolves.toBeUndefined();
    });
  });
});
