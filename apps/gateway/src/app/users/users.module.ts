import { Module } from '@nestjs/common';
import { UserResolver } from 'app/users/resolvers';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GrpcProvider } from '@admin-back/shared';
import {
  USER_GRPC_CLIENT,
  USER_SERVICE,
  USER_SERVICE_NAME,
  UserConfig,
} from '@admin-back/grpc';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: USER_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: UserConfig,
      },
    ]),
  ],
  providers: [
    GrpcProvider({
      provide: USER_SERVICE,
      service: USER_SERVICE_NAME,
      client: USER_GRPC_CLIENT,
    }),
    UserResolver,
  ],
  exports: [USER_SERVICE],
})
export class UsersModule {}
