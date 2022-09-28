import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovementModule } from 'app/movement/movement.module';
import { AccountService } from 'app/account/service';
import { AccountEntity, BalanceEntity } from 'app/account/entities';

const Entities = TypeOrmModule.forFeature([AccountEntity, BalanceEntity]);

@Module({
  imports: [Entities, MovementModule],
  controllers: [AccountService],
  providers: [],
})
export class AccountModule {}
