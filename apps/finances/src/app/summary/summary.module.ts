import { Module } from '@nestjs/common';
import { AccountModule } from 'app/account/account.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { SummaryService } from 'app/summary/service';

@Module({
  controllers: [SummaryService],
  imports: [CategoryModule, MovementModule, AccountModule],
})
export class SummaryModule {}
