import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from 'app/account/services';
import { AccountEntity, BalanceEntity } from 'app/account/entities';

const Entities = TypeOrmModule.forFeature([AccountEntity, BalanceEntity]);

@Module({
  imports: [Entities],
  controllers: [AccountService],
  exports: [Entities],
  providers: [],
})
export class AccountModule {}
