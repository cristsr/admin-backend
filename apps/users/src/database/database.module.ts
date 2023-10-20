import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV } from 'env';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: configService.get<any>(ENV.DB_TYPE),
        url: configService.get(ENV.DB_URI),
        ssl: false,
        synchronize: configService.get(ENV.DB_SYNCHRONIZE),
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
