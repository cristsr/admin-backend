import { Money } from '@app/shared/domain';
import { Account } from './account.entity';
import { InsufficientBalanceException } from './account.exception';

const buildAccount = (overrides: Partial<Account> = {}) =>
  Account.create({
    id: 1,
    name: 'Account',
    initialBalance: Money.of(100, 'COP'),
    allowNegativeBalance: false,
    user: 7,
    ...overrides,
  } as Account);

describe('Account', () => {
  describe('liveBalance', () => {
    it('adds the signed movement sum to what the account started with', () => {
      expect(buildAccount().liveBalance(50).amount).toBe(150);
      expect(buildAccount().liveBalance(-30).amount).toBe(70);
    });

    it('reports the balance in the account currency', () => {
      expect(buildAccount().liveBalance(0).currency).toBe('COP');
    });
  });

  describe('ensureCanWithdraw (AC-1)', () => {
    it('refuses a withdrawal the balance cannot cover', () => {
      expect(() =>
        buildAccount().ensureCanWithdraw(Money.of(150, 'COP'), 0),
      ).toThrow(InsufficientBalanceException);
    });

    it('allows a withdrawal that exactly empties the account', () => {
      expect(() =>
        buildAccount().ensureCanWithdraw(Money.of(100, 'COP'), 0),
      ).not.toThrow();
    });

    it('allows any withdrawal on an account that may go negative', () => {
      const creditCard = buildAccount({
        initialBalance: Money.zero('COP'),
        allowNegativeBalance: true,
      });

      expect(() =>
        creditCard.ensureCanWithdraw(Money.of(9999, 'COP'), 0),
      ).not.toThrow();
    });

    it('counts the movements, not just the opening balance', () => {
      // opened with 100, spent 80 → only 20 left
      expect(() =>
        buildAccount().ensureCanWithdraw(Money.of(50, 'COP'), -80),
      ).toThrow(InsufficientBalanceException);
    });
  });
});
