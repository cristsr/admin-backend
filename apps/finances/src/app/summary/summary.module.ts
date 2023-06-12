import { Module } from '@nestjs/common';
import { SummaryService } from 'app/summary/service';
import { MovementModule } from 'app/movement/movement.module';
import { AccountModule } from 'app/account/account.module';
import { CategoryModule } from 'app/category/category.module';

@Module({
  controllers: [SummaryService],
  imports: [CategoryModule, MovementModule, AccountModule],
})
export class SummaryModule {}
