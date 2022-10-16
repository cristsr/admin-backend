import { Module } from '@nestjs/common';
import { BillService } from './services/bill.service';

@Module({
  controllers: [],
  providers: [BillService],
})
export class BillModule {}
