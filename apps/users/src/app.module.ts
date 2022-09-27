import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configValidator } from '@admin-back/shared';
import { UserEnvironment } from 'env';
import { DatabaseModule } from 'database/database.module';
import { UserModule } from 'app/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: object) => configValidator(config, UserEnvironment),
    }),
    DatabaseModule,
    UserModule,
  ],
})
export class AppModule {}
