import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { useContainer } from 'class-validator';
import { ENV } from 'app/env';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const config = app.get(ConfigService);

  const port = config.get(ENV.PORT);

  await app.listen(port);

  Logger.log(`🚀 Finances microservice is running on port ${port}`);
}
bootstrap();
