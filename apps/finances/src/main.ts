import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { FinancesConfig } from '@admin-back/grpc';
import { AppModule } from './app.module';

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
    })
  );

  await app.listen();

  Logger.log(`🚀 Finances microservice is running`);
}
bootstrap();
