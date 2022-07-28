import { Module } from '@nestjs/common';
import { AuthService } from 'domain/auth/services';
import { AuthResolver } from 'domain/auth/resolvers';

@Module({
  providers: [AuthResolver, AuthService]
})
export class AuthModule {}
