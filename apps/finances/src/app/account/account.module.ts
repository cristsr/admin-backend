import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from 'app/account/services';
import { AccountEntity } from 'app/account/entities';
import { MovementModule } from 'app/movement/movement.module';
import { AccountRepository } from 'app/account/repositories';

const Repositories = [AccountRepository];

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity]),
    forwardRef(() => MovementModule),
  ],
  controllers: [AccountService],
  exports: [...Repositories],
  providers: [...Repositories],
})
export class AccountModule {}
