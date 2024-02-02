import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from 'app/account/entities';
import { AccountRepository } from 'app/account/repositories';
import { AccountService } from 'app/account/services';
import { MovementModule } from 'app/movement/movement.module';

const Repositories = [AccountRepository];

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity], ),
    forwardRef(() => MovementModule),
  ],
  controllers: [AccountService],
  exports: [...Repositories],
  providers: [...Repositories],
})
export class AccountModule {}
