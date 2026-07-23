import { defineContract } from './define-contract';

const executed: string[] = [];

// Declared first so its cases have already run when the assertion below runs.
defineContract('a contract', [
  {
    name: 'case one',
    verify: () => {
      executed.push('one');
    },
  },
  {
    name: 'case two',
    verify: () => {
      executed.push('two');
    },
  },
]);

describe('defineContract', () => {
  it('runs every case it is given', () => {
    expect(executed).toEqual(['one', 'two']);
  });
});
