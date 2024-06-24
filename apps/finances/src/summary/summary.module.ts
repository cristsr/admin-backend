import { Module } from '@nestjs/common';
import { AccountModule } from 'app/account/account.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { SummaryController } from 'app/summary/controllers';
import { SummaryService } from 'app/summary/services';

@Module({
  imports: [CategoryModule, MovementModule, AccountModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
