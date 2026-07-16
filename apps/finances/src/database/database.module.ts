import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV } from 'app/env';

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
        migrations: ['dist/apps/finances/database/migrations/*.js'],
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
