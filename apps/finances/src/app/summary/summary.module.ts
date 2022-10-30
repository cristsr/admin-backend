import { Module } from '@nestjs/common';
import { SummaryService } from 'app/summary/service';
import { MovementModule } from 'app/movement/movement.module';
import { AccountModule } from 'app/account/account.module';

@Module({
  controllers: [SummaryService],
  imports: [MovementModule, AccountModule],
})
export class SummaryModule {}
