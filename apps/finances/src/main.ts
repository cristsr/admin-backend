import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { FinancesConfig } from '@admin-back/grpc';
import { AppModule } from './app.module';

process.on('uncaughtException', (err: Error) => {
  Logger.error(`uncaughtException: ${err.message}`, err.stack);
});

process.on('unhandledRejection', (err: Error) => {
  Logger.error(`unhandledRejection: ${err.message}`, err.stack);
});

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: FinancesConfig,
    }
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
    })
  );

  await app.listen();

  Logger.log(`🚀 Finances microservice is running`);
}
bootstrap();
