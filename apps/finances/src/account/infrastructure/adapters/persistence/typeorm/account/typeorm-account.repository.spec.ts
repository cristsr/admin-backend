import { TypeOrmAccountRepository } from './typeorm-account.repository';

describe('TypeOrmAccountRepository balance', () => {
  it('movementBalance returns the signed sum as a number', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ total: '150.00' }]),
    } as any;
    const repo = new TypeOrmAccountRepository({} as any, dataSource);

    const balance = await repo.movementBalance(1, 7);

    expect(balance).toBe(150);
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('CASE'), [1, 7]);
  });

  it('movementBalancesByUser indexes by account_id', async () => {
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
