import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummaryService } from 'app/summary/service';
import { SummaryEntity } from 'app/summary/entities';
import { MovementModule } from 'app/movement/movement.module';
import { AccountModule } from 'app/account/account.module';

const Entities = TypeOrmModule.forFeature([SummaryEntity]);

@Module({
  controllers: [SummaryService],
  imports: [Entities, MovementModule, AccountModule],
})
export class SummaryModule {}
