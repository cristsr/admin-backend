import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountController } from 'app/account/controllers';
import { AccountEntity } from 'app/account/entities';
import { AccountRepository } from 'app/account/repositories';
import { AccountService } from 'app/account/services';
import { MovementModule } from 'app/movement/movement.module';

const Repositories = [AccountRepository];

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity]),
    forwardRef(() => MovementModule),
  ],
  exports: [...Repositories],
  controllers: [AccountController],
  providers: [...Repositories, AccountService],
})
export class AccountModule {}
