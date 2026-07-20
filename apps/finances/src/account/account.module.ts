import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FindAccountUsecase,
  FindAllAccountsUsecase,
  GetAccountBalanceUsecase,
  RemoveAccountUsecase,
  SaveAccountUsecase,
} from './application/usecases';
import { AccountRepository } from './domain/account';
import { AccountController } from './infrastructure/adapters/http';
import {
  TypeOrmAccountEntity,
  TypeOrmAccountRepository,
} from './infrastructure/adapters/persistence/typeorm/account';

@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmAccountEntity])],
  controllers: [AccountController],
  providers: [
    { provide: AccountRepository, useClass: TypeOrmAccountRepository },
    FindAccountUsecase,
    FindAllAccountsUsecase,
    GetAccountBalanceUsecase,
    SaveAccountUsecase,
    RemoveAccountUsecase,
  ],
  exports: [AccountRepository],
})
export class AccountModule {}
