import { InvalidConfigurationException, configValidator } from '@shared';
import { Environment } from './env';

describe('Environment', () => {
  const validEnvironment: Record<string, string> = {
    ENV: 'test',
    PORT: '3100',
    DB_TYPE: 'postgres',
    DB_URI: 'postgres://user:pass@localhost:5432/ledger',
    DB_SSL: 'false',
    DB_SYNCHRONIZE: 'false',
  };

  it('fails fast when a required variable is missing', () => {
    const { DB_URI: _dbUri, ...incomplete } = validEnvironment;

    expect(() => configValidator(incomplete, Environment)).toThrow(InvalidConfigurationException);
  });

  it('coerces PORT and DB_SSL from strings', () => {
    const env = configValidator(validEnvironment, Environment) as Environment;

    expect(env.PORT).toBe(3100);
    expect(env.DB_SSL).toBe(false);
    expect(env.DB_SYNCHRONIZE).toBe(false);
  });
});
