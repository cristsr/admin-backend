import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiModule } from '@shared';
import { ENV } from 'app/env';
import {
  AccountResolver,
  BudgetResolver,
  CategoryResolver,
  MovementResolver,
  ScheduledResolver,
  SubcategoryResolver,
  SummaryResolver,
} from 'app/modules/finances';
import { FINANCES_API } from './constants';

@Module({
  imports: [
    ApiModule.registerAsync({
      name: FINANCES_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.get(ENV.FINANCES_API_URL),
      }),
    }),
  ],
  providers: [
    AccountResolver,
    CategoryResolver,
    SubcategoryResolver,
    MovementResolver,
    BudgetResolver,
    ScheduledResolver,
    SummaryResolver,
  ],
  exports: [
    AccountResolver,
    CategoryResolver,
    SubcategoryResolver,
    MovementResolver,
    BudgetResolver,
    ScheduledResolver,
    SummaryResolver,
  ],
})
export class FinancesModule {}
