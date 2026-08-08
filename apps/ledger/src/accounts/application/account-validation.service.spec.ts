import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Nullable } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/application/read-models/account-tree.read-model';
import {
  AccountClosedException,
  CurrencyNotAllowedException,
  SystemAccountProtectedException,
} from '@ledger/accounts/domain/account/exceptions/account.exception';
import { AccountNotFoundException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { aMoney } from '@ledger/shared/testing';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { AccountValidationService } from './account-validation.service';
import { PostingOrigin } from './posting-origin';

type AccountSeed = {
  readonly accountId: string;
  readonly isSystem?: boolean;
  readonly currencyCode?: Nullable<string>;
  readonly closedOn?: Nullable<string>;
};

const date = LedgerDate.of('2026-07-20');

async function serviceWith(seeds: readonly AccountSeed[]): Promise<AccountValidationService> {
  const store = new InMemoryReadModelStore();

  for (const seed of seeds) {
    await store.upsert(
      PROJ_ACCOUNTS,
      { account_id: seed.accountId },
      {
        account_id: seed.accountId,
        user_id: 'user-1',
        type: 'ASSETS',
        name: `Assets:${seed.accountId}`,
        parent_id: null,
        currency_code: seed.currencyCode ?? 'USD',
        opened_on: '2026-01-01',
        closed_on: seed.closedOn ?? null,
        is_bank_mirror: false,
        is_system: seed.isSystem ?? false,
      },
    );
  }

  return new AccountValidationService(store);
}

const posting = (accountId: string): PostingLine =>
  PostingLine.of({ accountId, amount: aMoney().of('100').inUsd(), metadata: {} });

describe('AccountValidationService', () => {
  it('accepts postings against open accounts that allow the currency', async () => {
    const service = await serviceWith([{ accountId: 'acc-1' }, { accountId: 'acc-2' }]);

    const types = await service.validate('user-1', date, [posting('acc-1'), posting('acc-2')]);

    expect(types).toEqual(['ASSETS', 'ASSETS']);
  });

  it('rejects an unknown account (INV-3)', async () => {
    const service = await serviceWith([]);

    await expect(service.validate('user-1', date, [posting('ghost')])).rejects.toBeInstanceOf(
      AccountNotFoundException,
    );
  });

  it('rejects an account closed before the transaction date (INV-3)', async () => {
    const service = await serviceWith([{ accountId: 'acc-1', closedOn: '2026-07-01' }]);

    await expect(service.validate('user-1', date, [posting('acc-1')])).rejects.toBeInstanceOf(
      AccountClosedException,
    );
  });

  it('rejects a currency the account does not accept (INV-4)', async () => {
    const service = await serviceWith([{ accountId: 'acc-1', currencyCode: 'COP' }]);

    await expect(service.validate('user-1', date, [posting('acc-1')])).rejects.toBeInstanceOf(
      CurrencyNotAllowedException,
    );
  });

  describe('system accounts (INV-13)', () => {
    it('rejects a client posting against a system account with SYSTEM_ACCOUNT_PROTECTED', async () => {
      const service = await serviceWith([{ accountId: 'acc-1' }, { accountId: 'sys-1', isSystem: true }]);

      await expect(
        service.validate(
          'user-1',
          date,
          [posting('acc-1'), posting('sys-1')],
          PostingOrigin.CLIENT,
        ),
      ).rejects.toBeInstanceOf(SystemAccountProtectedException);
    });

    it('defaults to CLIENT when no origin is stated (fails closed)', async () => {
      const service = await serviceWith([{ accountId: 'sys-1', isSystem: true }]);

      await expect(service.validate('user-1', date, [posting('sys-1')])).rejects.toBeInstanceOf(
        SystemAccountProtectedException,
      );
    });

    it('accepts a system posting against a system account', async () => {
      const service = await serviceWith([{ accountId: 'acc-1' }, { accountId: 'sys-1', isSystem: true }]);

      const types = await service.validate(
        'user-1',
        date,
        [posting('acc-1'), posting('sys-1')],
        PostingOrigin.SYSTEM,
      );

      expect(types).toEqual(['ASSETS', 'ASSETS']);
    });

    it('leaves regular accounts untouched by the origin', async () => {
      const service = await serviceWith([{ accountId: 'acc-1' }]);

      await expect(
        service.validate('user-1', date, [posting('acc-1')], PostingOrigin.CLIENT),
      ).resolves.toEqual(['ASSETS']);
    });
  });
});
