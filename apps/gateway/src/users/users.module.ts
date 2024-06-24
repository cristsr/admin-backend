import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { USER_GRPC_CLIENT, USER_HANDLER, UserConfig, UserHandler } from '@core';
import { GrpcProvider } from '@shared';
import { UserResolver } from 'app/users/resolvers';

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
      provide: UserHandler,
      service: USER_HANDLER,
      client: USER_GRPC_CLIENT,
    }),
    UserResolver,
  ],
  exports: [UserHandler],
})
export class UsersModule {}
