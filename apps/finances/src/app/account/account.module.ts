import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from 'app/account/services';
import { AccountEntity } from 'app/account/entities';
import { MovementModule } from 'app/movement/movement.module';
import { AccountRepository } from 'app/account/repositories';

const Entities = TypeOrmModule.forFeature([AccountEntity]);
const Repositories = [AccountRepository];

@Module({
  imports: [Entities, forwardRef(() => MovementModule)],
  controllers: [AccountService],
  exports: [Entities],
  providers: [...Repositories],
})
export class AccountModule {}
