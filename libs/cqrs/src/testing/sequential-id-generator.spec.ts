import { runIdGeneratorContract } from './contract/id-generator.contract';
import { SequentialIdGenerator } from './sequential-id-generator';

runIdGeneratorContract(() => new SequentialIdGenerator());

describe('SequentialIdGenerator', () => {
  it('is reproducible from a fresh instance', () => {
    const first = new SequentialIdGenerator();
    const second = new SequentialIdGenerator();

    expect([first.next(), first.next()]).toEqual([second.next(), second.next()]);
  });
});
