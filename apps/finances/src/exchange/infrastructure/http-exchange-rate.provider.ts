import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ENV } from '../../env';
import {
  ExchangeRateProvider,
  ExchangeRateUnavailableException,
} from '../domain';

/**
 * Consume las tasas del microservicio `exchanges` por HTTP.
 *
 * ⚠️ BLOQUEANTE: `exchanges` está huérfano/roto y su contrato HTTP (path,
 * params, shape de respuesta, carry-forward) todavía no existe. La forma de la
 * request de abajo es una propuesta; ajustar cuando el contrato esté definido.
 */
@Injectable()
export class HttpExchangeRateProvider implements ExchangeRateProvider {
  constructor(private readonly config: ConfigService) {}

  async getRate(from: string, to: string, date: Date): Promise<number> {
    const baseUrl = this.config.get<string>(ENV.EXCHANGES_API_URL);
    if (!baseUrl) {
      throw new ExchangeRateUnavailableException(
        'Exchange rates service (exchanges) is not configured',
      );
    }

    try {
      const { data } = await axios.get<{ rate: number }>(`${baseUrl}/rates`, {
        params: { from, to, date: date.toISOString() },
      });
      if (data?.rate == null) {
        throw new ExchangeRateUnavailableException(
          `No rate for ${from}->${to} at ${date.toISOString()}`,
        );
      }
      return Number(data.rate);
    } catch (error) {
      if (error instanceof ExchangeRateUnavailableException) throw error;
      throw new ExchangeRateUnavailableException(
        `Could not fetch rate ${from}->${to} at ${date.toISOString()}`,
        { cause: error as Error },
      );
    }
  }
}
