import { Module } from '@nestjs/common';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from 'app/auth/controllers';
import {
  AUTH_GRPC_CLIENT,
  AUTH_SERVICE,
  AUTH_SERVICE_NAME,
} from 'app/auth/const';

import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'app/auth/guards';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: AUTH_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, 'assets/auth.proto'),
        },
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
  ],
  controllers: [AuthController],
  exports: [AUTH_SERVICE],
})
export class AuthModule {}
