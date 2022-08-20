import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummaryHandler } from 'app/summary/handler';
import { SummaryController } from 'app/summary/service';
import { BalanceEntity, SummaryEntity } from 'app/summary/entities';
import { MovementModule } from 'apps/finances/src/app/movement/movement.module';

@Module({
  controllers: [SummaryController],
  providers: [SummaryHandler],
  imports: [
    TypeOrmModule.forFeature([SummaryEntity, BalanceEntity]),
    MovementModule,
  ],
})
export class SummaryModule {}
