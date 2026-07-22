import {
  ExchangeRate,
  ExchangeRateRepository,
  ExchangeRateSource,
  ExchangeRateUnavailableException,
} from '@app/exchange/domain';
import { CachingExchangeRateProvider } from './caching-exchange-rate.provider';

describe('CachingExchangeRateProvider', () => {
  const findRate = jest.fn();
  const save = jest.fn();
  const fetchRate = jest.fn();
  const repository = { findRate, save } as unknown as ExchangeRateRepository;
  const source = { fetchRate } as unknown as ExchangeRateSource;
  const provider = new CachingExchangeRateProvider(repository, source);

  const date = new Date('2026-07-21T00:00:00.000Z');

  afterEach(() => jest.clearAllMocks());

  it('returns a cached rate without hitting the source', async () => {
    findRate.mockResolvedValue(ExchangeRate.create({ id: 1, from: 'USD', to: 'COP', rate: 4000, date }));

    await expect(provider.getRate('USD', 'COP', date)).resolves.toBe(4000);
    expect(fetchRate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('fetches, persists and returns the rate on a cache miss', async () => {
    findRate.mockResolvedValue(null);
    fetchRate.mockResolvedValue(4200);
    save.mockImplementation((rate: ExchangeRate) => Promise.resolve(rate));

    await expect(provider.getRate('USD', 'COP', date)).resolves.toBe(4200);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('raises when neither the cache nor the source has a rate', async () => {
    findRate.mockResolvedValue(null);
    fetchRate.mockResolvedValue(null);

    await expect(provider.getRate('USD', 'COP', date)).rejects.toBeInstanceOf(
      ExchangeRateUnavailableException,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
