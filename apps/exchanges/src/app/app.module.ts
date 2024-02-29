import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Environment } from 'env';
import { validatorFactory } from '@admin-back/shared';
import { ExchangeEntity } from 'app/entities';
import { ExRatesService, ExchangeRatesService } from 'app/providers';
import { ExchangeRepository } from 'app/repositories';
import { AppService } from 'app/services';
import { DatabaseModule } from '../database/database.module';
import { AppController } from './cotrollers';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(Environment),
    }),
    HttpModule,
    DatabaseModule,
    TypeOrmModule.forFeature([ExchangeEntity]),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: ExchangeRatesService,
      useClass: ExRatesService,
    },
    ExchangeRepository,
    AppService,
  ],
})
export class AppModule {}
