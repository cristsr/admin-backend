import { TransientPersistenceException } from './transient-persistence.exception';

describe('TransientPersistenceException', () => {
  it('carries a stable TRANSIENT_PERSISTENCE code', () => {
    const error = new TransientPersistenceException('boom');

    expect(error.code).toBe('TRANSIENT_PERSISTENCE');
    expect(error).toBeInstanceOf(Error);
  });
});
