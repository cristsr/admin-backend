import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ApiModule } from '@shared';
import { AuthController } from 'app/auth/controllers';
import { JwtGuard } from 'app/auth/guards';
import { AuthResolver } from 'app/auth/resolvers';
import { JwtStrategy } from 'app/auth/strategies';
import { ENV } from 'app/env';
import { USER_API } from 'app/modules/users/constants';
import { UsersModule } from 'app/modules/users/users.module';

@Module({
  imports: [
    PassportModule.register({}),
    ApiModule.registerAsync({
      name: USER_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.get(ENV.USERS_API_URL),
      }),
    }),
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    AuthResolver,
    JwtStrategy,
  ],
  controllers: [AuthController],
  exports: [],
})
export class AuthModule {}
