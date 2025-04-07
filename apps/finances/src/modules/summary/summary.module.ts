import { Module } from '@nestjs/common';
import { AccountModule } from 'app/modules/account/account.module';
import { CategoryModule } from 'app/modules/category/category.module';
import { MovementModule } from 'app/modules/movement/movement.module';
import { SummaryController } from 'app/modules/summary/controllers';
import { SummaryService } from 'app/modules/summary/services';

@Module({
  imports: [CategoryModule, MovementModule, AccountModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
