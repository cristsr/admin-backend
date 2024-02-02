import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from 'app/auth/controllers';
import { JwtGuard } from 'app/auth/guards';
import { AuthResolver } from 'app/auth/resolvers';
import { JwtStrategy } from 'app/auth/strategies';
import { UsersModule } from 'app/users';

@Module({
  imports: [PassportModule.register({}), UsersModule],
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
