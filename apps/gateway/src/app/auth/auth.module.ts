import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { APP_GUARD } from '@nestjs/core';
import {
  AUTH_GRPC_CLIENT,
  AUTH_SERVICE,
  AUTH_SERVICE_NAME,
  AuthConfig,
  GrpcProvider,
} from '@admin-back/grpc';
import { AuthController } from 'app/auth/controllers';
import { AuthGuard } from 'app/auth/guards';
import { AuthResolver } from 'app/auth/resolvers';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: AUTH_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: AuthConfig,
      },
    ]),
  ],
  providers: [
    GrpcProvider({
      provide: AUTH_SERVICE,
      service: AUTH_SERVICE_NAME,
      client: AUTH_GRPC_CLIENT,
    }),
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    AuthResolver,
  ],
  controllers: [AuthController],
  exports: [AUTH_SERVICE],
})
export class AuthModule {}
