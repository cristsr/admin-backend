// MUST stay the first import: auto-instrumentations patch modules as they are
// required, so anything loaded earlier is never traced.
import '@shared/telemetry/instrumentation';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppConfig, appConfig } from '@app/config/environment';
import { AppModule } from './app.module';
import { maybeMountSwagger } from './config/swagger/swagger.builder';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Bootstrap logs are buffered until the pino logger is wired below.
    bufferLogs: true,
  });

  // Trust the proxy chain so `request.ip` is the real client IP, not NGINX.
  app.set('trust proxy', true);

  app.useLogger(app.get(PinoLogger));
  app.flushLogs();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const config = app.get<AppConfig>(appConfig.KEY);

  // Mount the Swagger UI only outside production.
  maybeMountSwagger(app, config.showDocs);

  await app.listen(config.port);

  Logger.log(`🚀 Finances microservice is running on port ${config.port}`);
}
bootstrap();
