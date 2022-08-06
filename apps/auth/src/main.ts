import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AuthConfig } from '@admin-back/grpc';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: AuthConfig,
    }
  );

  await app.listen();

  Logger.log(`🚀 Auth microservice is running`);
}

bootstrap();
