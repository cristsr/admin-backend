import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from 'app/account/services';
import { AccountEntity } from 'app/account/entities';
import { MovementModule } from 'app/movement/movement.module';

const Entities = TypeOrmModule.forFeature([AccountEntity]);

@Module({
  imports: [Entities, forwardRef(() => MovementModule)],
  controllers: [AccountService],
  exports: [Entities],
  providers: [],
})
export class AccountModule {}
