import { PersistenceConflictException } from './persistence-conflict.exception';

describe('PersistenceConflictException', () => {
  it('carries the stable PERSISTENCE_CONFLICT code', () => {
    const error = new PersistenceConflictException('exhausted');

    expect(error.code).toBe('PERSISTENCE_CONFLICT');
  });
});
