import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from 'app/account/services';
import { AccountEntity, BalanceEntity } from 'app/account/entities';
import { MovementSubscriber } from 'app/account/subscribers';
import { MovementModule } from 'app/movement/movement.module';
import { BalanceHandler } from 'app/account/handlers/balance.handler';

const Entities = TypeOrmModule.forFeature([AccountEntity, BalanceEntity]);

@Module({
  imports: [Entities, forwardRef(() => MovementModule)],
  controllers: [AccountService],
  exports: [Entities],
  providers: [MovementSubscriber, BalanceHandler],
})
export class AccountModule {}
