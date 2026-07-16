import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  Auth0IdentityResolver,
  AuthModule,
  ExceptionFilter,
  ResponseInterceptor,
  validatorFactory,
} from '@shared';
import { DatabaseModule } from 'app/config/database';
import { ENV, UserEnvironment } from 'app/config/env';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(UserEnvironment),
    }),
    DatabaseModule,
    AuthModule.forRootAsync({
      inject: [ConfigService],
      identityResolver:
        process.env.AUTH_IDENTITY_PROVIDER === 'auth0'
          ? Auth0IdentityResolver
          : undefined,
      useFactory: (configService: ConfigService) => ({
        issuer: configService.get(ENV.OIDC_ISSUER),
        audience: configService.get(ENV.OIDC_AUDIENCE),
        usersServiceUrl: configService.get(ENV.USERS_API_URL),
      }),
    }),
    UserModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        forbidUnknownValues: false,
      }),
    },
  ],
})
export class AppModule {}
