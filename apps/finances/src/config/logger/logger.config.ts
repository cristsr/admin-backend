import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Params } from 'nestjs-pino';

export const CORRELATION_HEADER = 'X-Request-Id'.toLowerCase();

/** Node joins repeated headers into an array; only the first value matters. */
function firstHeaderValue(
  header: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(header)) return header[0];

  return header;
}

/**
 * Correlation id comes from `X-Request-Id` when the edge supplies it,
 * otherwise one is generated; it rides on pino's `req.id`.
 */
export function buildPinoModuleOptions(): Params {
  return {
    pinoHttp: {
      genReqId: (req: IncomingMessage) => {
        const header = firstHeaderValue(req.headers?.[CORRELATION_HEADER]);
        return header ?? randomUUID();
      },
      customProps: (req: IncomingMessage & { id?: string }) => ({
        correlationId: req.id,
      }),
      autoLogging: true,
    },
  };
}
