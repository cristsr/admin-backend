import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Params } from 'nestjs-pino';

export const CORRELATION_HEADER = 'X-Request-Id'.toLowerCase();

/**
 * Structured logger based on `nestjs-pino`. The correlation id is taken from
 * the incoming `X-Request-Id` when the edge (NGINX) supplies it; otherwise the
 * service generates one, so every request — including tests, crons and internal
 * calls — carries a trace id (AC-4). The id is attached to log lines via the
 * standard pino `req.id` field, and downstream handlers reuse it for the trace
 * propagation across the outbox boundary.
 */
export function buildPinoModuleOptions(): Params {
  return {
    pinoHttp: {
      genReqId: (req: IncomingMessage) => {
        const header = req.headers?.[CORRELATION_HEADER];
        const value = Array.isArray(header) ? header[0] : header;
        return value ?? randomUUID();
      },
      customProps: (req: IncomingMessage & { id?: string }) => ({
        correlationId: req.id,
      }),
      autoLogging: true,
    },
  };
}
