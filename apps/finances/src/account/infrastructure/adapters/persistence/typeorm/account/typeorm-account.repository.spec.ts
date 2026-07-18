import { TypeOrmAccountRepository } from './typeorm-account.repository';

describe('TypeOrmAccountRepository saldo (AC-3)', () => {
  it('movementBalance devuelve la suma firmada como número', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ total: '150.00' }]),
    } as any;
    const repo = new TypeOrmAccountRepository({} as any, dataSource);

    const balance = await repo.movementBalance(1, 7);

    expect(balance).toBe(150);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('CASE'),
      [1, 7],
    );
  });

  it('movementBalancesByUser indexa por account_id', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        { account_id: 1, total: '150.00' },
        { account_id: 2, total: '-20.00' },
      ]),
    } as any;
    const repo = new TypeOrmAccountRepository({} as any, dataSource);

    const balances = await repo.movementBalancesByUser(7);

    expect(balances).toEqual({ 1: 150, 2: -20 });
  });
});
