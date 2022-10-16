import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummaryHandler } from 'app/summary/handler';
import { SummaryService } from 'app/summary/service';
import { SummaryEntity } from 'app/summary/entities';
import { MovementModule } from 'app/movement/movement.module';
import { AccountModule } from 'app/account/account.module';

const Entities = TypeOrmModule.forFeature([SummaryEntity]);

@Module({
  controllers: [SummaryService],
  providers: [SummaryHandler],
  imports: [Entities, MovementModule, AccountModule],
})
export class SummaryModule {}
