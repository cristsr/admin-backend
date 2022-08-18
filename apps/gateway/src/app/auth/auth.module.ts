import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import {
  AUTH_GRPC_CLIENT,
  AUTH_SERVICE,
  AUTH_SERVICE_NAME,
  AuthConfig,
  GrpcProvider,
} from '@admin-back/grpc';
import { JwtGuard } from 'app/auth/guards';
import { JwtStrategy } from 'app/auth/strategies';
import { AuthResolver } from 'app/auth/resolvers';
import { AuthController } from 'app/auth/controllers';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
      useClass: JwtGuard,
    },
    AuthResolver,
    JwtStrategy,
  ],
  controllers: [AuthController],
  exports: [AUTH_SERVICE],
})
export class AuthModule {}
