import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthenticatedUserProvider } from '@shared';
import {
  FindAllUsersUsecase,
  FindUserUsecase,
  RemoveUserUsecase,
  SaveUserUsecase,
} from './application/usecases';
import { UserRepository } from './domain/user';
import { TypeOrmAuthenticatedUserProvider } from './infrastructure/adapters/auth';
import { UserController } from './infrastructure/adapters/http';
import { TypeOrmUserEntity, TypeOrmUserRepository } from './infrastructure/adapters/persistence/typeorm/user';

@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmUserEntity])],
  controllers: [UserController],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    // Binds the auth port so the JWT strategy resolves users via DI, not HTTP.
    {
      provide: AuthenticatedUserProvider,
      useClass: TypeOrmAuthenticatedUserProvider,
    },
    FindAllUsersUsecase,
    FindUserUsecase,
    SaveUserUsecase,
    RemoveUserUsecase,
  ],
  exports: [AuthenticatedUserProvider],
})
export class UserModule {}
