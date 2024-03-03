import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MainModule } from './main.module';

process.on('unhandledRejection', function (err) {
  const logger = new Logger('unhandledRejection');
  logger.error(err);
});

// Better error logging of uncaughtException errors
process.on('uncaughtException', (err) => {
  const logger = new Logger('uncaughtException');
  logger.error(err);
  // process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(MainModule);

  app.enableCors();

  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     transform: true,
  //     forbidUnknownValues: false,
  //   })
  // );

  const port = process.env.PORT || 80;

  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap();
