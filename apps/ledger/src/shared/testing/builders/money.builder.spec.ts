import { aMoney } from './money.builder';

describe('aMoney', () => {
  it('builds money fluently, stating the amount first', () => {
    expect(aMoney().of('100').inUsd().toString()).toBe('100 USD');
    expect(aMoney().of('-799').inCop().toString()).toBe('-799 COP');
  });
});
