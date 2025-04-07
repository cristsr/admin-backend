import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountController } from 'app/modules/account/controllers';
import { AccountEntity } from 'app/modules/account/entities';
import { AccountRepository } from 'app/modules/account/repositories';
import { AccountService } from 'app/modules/account/services';
import { MovementModule } from 'app/modules/movement/movement.module';

const Repositories = [AccountRepository];

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity]),
    forwardRef(() => MovementModule),
  ],
  controllers: [AccountController],
  providers: [...Repositories, AccountService],
  exports: [...Repositories],
})
export class AccountModule {}
