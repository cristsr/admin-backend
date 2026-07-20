// MUST stay the first import of the process: the auto-instrumentations patch
// modules as they are required, so anything loaded above this line would never
// be traced. Side-effect imports are not reordered by import-x/order, but do
// not move it by hand either.
import './config/telemetry/instrumentation';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ENV } from '@app/env';
import { AppModule } from './app.module';
import { maybeMountSwagger } from './config/swagger/swagger.builder';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // `nestjs-pino` (LoggerModule in AppModule) owns the HTTP access logs; the
    // buffered bootstrap logs are flushed once its logger is wired below.
    bufferLogs: true,
  });

  // AC-5: trust the proxy chain so `request.ip` resolves the real client IP
  // from X-Forwarded-For (the throttler counts against the actual caller, not
  // NGINX).
  app.set('trust proxy', true);

  // AC-4: route every Nest log line through the structured pino logger.
  app.useLogger(app.get(PinoLogger));
  app.flushLogs();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const config = app.get(ConfigService);

  // AC-1: generate the OpenAPI contract; mount the navigable UI only outside
  // production (SHOW_DOCS).
  maybeMountSwagger(app, config.get<boolean>(ENV.SHOW_DOCS) === true);

  const port = config.get(ENV.PORT);

  await app.listen(port);

  Logger.log(`🚀 Finances microservice is running on port ${port}`);
}
bootstrap();
