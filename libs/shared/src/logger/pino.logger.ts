import { LoggerService } from '@nestjs/common';
import pino from 'pino';
import pretty from 'pino-pretty';

const stream = pretty({
  levelKey: 'debug',
  colorize: true,
});
const log = pino(
  {
    level: 'trace',
  },
  pretty()
);

export class PinoLogger implements LoggerService {
  public log(message: any, context?: string | undefined) {
    log.info({ context }, message);
  }

  public debug(message: any, context?: string | undefined) {
    log.debug({ context }, message);
  }

  public error(
    message: any,
    trace?: string | undefined,
    context?: string | undefined
  ) {
    log.error({ trace, context }, message);
  }

  public warn(message: any, context?: string | undefined) {
    log.error({ context }, message);
  }
}
