import { NestFactory } from '@nestjs/core';
import { MainModule } from './main.module';
import { Logger } from '@nestjs/common';

process.on('unhandledRejection', function (err) {
  console.error(err, '[unhandledRejection]');
});

// Better error logging of uncaughtException errors
process.on('uncaughtException', (err) => {
  console.error(err, '[Uncaught Exception thrown]');

  // process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(MainModule);

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.PORT || 3333;

  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
