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
        // Compared against true on purpose: an untyped get() can hand back the
        // string 'false', which is truthy and would let TypeORM rewrite the
        // schema on boot, dropping whatever the entities no longer declare.
        synchronize: configService.get<boolean>(ENV.DB_SYNCHRONIZE) === true,
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
