import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiModule } from '@shared';
import { ENV } from 'app/env';
import { USER_API } from 'app/modules/users/constants';
import { UserResolver } from 'app/modules/users/resolvers';

@Module({
  imports: [
    ApiModule.registerAsync({
      name: USER_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.get(ENV.USERS_API_URL),
      }),
    }),
  ],
  providers: [UserResolver],
})
export class UsersModule {}
