import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV } from 'env';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: configService.get<any>(ENV.DB_TYPE),
        url: configService.get(ENV.DB_URI),
        synchronize: configService.get(ENV.DB_SYNCHRONIZE),
        autoLoadEntities: true,
        debug: true,
        extra: {
          columnTypes: {
            timestamp: 'timestamp with time zone',
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
