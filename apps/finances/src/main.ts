import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from 'apps/finances/src/env';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  app.enableCors();

  app.setGlobalPrefix('api');

  app.enableVersioning();

  const port = configService.get(ENV.PORT);
  const env = configService.get(ENV.ENV);

  await app.listen(port);

  Logger.log(`App running on port ${port} in ${env} env `, 'Bootstrap');
}
bootstrap();
