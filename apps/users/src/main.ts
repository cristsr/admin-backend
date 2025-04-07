import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ENV } from 'app/config/env';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const config = app.get(ConfigService);

  const port = config.get(ENV.PORT);

  await app.listen(port);

  Logger.log(`🚀 Application is running on port ${port}`);
}

bootstrap();
