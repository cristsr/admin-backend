import { Module } from '@nestjs/common';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import { APP_GUARD } from '@nestjs/core';
import { AuthConfig } from '@admin-back/grpc';
import {
  AUTH_GRPC_CLIENT,
  AUTH_SERVICE,
  AUTH_SERVICE_NAME,
} from 'app/auth/const';
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
    {
      provide: AUTH_SERVICE,
      useFactory: (client: ClientGrpc) => client.getService(AUTH_SERVICE_NAME),
      inject: [AUTH_GRPC_CLIENT],
    },
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
