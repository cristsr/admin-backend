import { Module } from '@nestjs/common';
import { AuthService } from 'domain/auth2/services';
import { AuthResolver } from 'domain/auth2/resolvers';

@Module({
  providers: [AuthResolver, AuthService],
})
export class AuthgraphModule {}
