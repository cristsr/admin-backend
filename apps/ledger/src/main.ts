// MUST stay the first import: auto-instrumentations patch modules as they are
// required, so anything loaded earlier is never traced.
import '@shared/telemetry/instrumentation';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppConfig, appConfig } from '@ledger/config/environment';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Bootstrap logs are buffered until the pino logger is wired below.
    bufferLogs: true,
  });

  // Trust the proxy chain so `request.ip` is the real client IP, not NGINX.
  app.set('trust proxy', true);

  app.useLogger(app.get(PinoLogger));
  app.flushLogs();

  const config = app.get<AppConfig>(appConfig.KEY);

  await app.listen(config.port);

  Logger.log(`🚀 Ledger service is running on port ${config.port}`);
}
bootstrap();
