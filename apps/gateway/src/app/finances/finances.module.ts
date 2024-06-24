import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  ACCOUNT_HANDLER,
  BUDGET_HANDLER,
  CATEGORY_HANDLER,
  FINANCES_GRPC_CLIENT,
  FinancesConfig,
  MOVEMENT_HANDLER,
  SCHEDULED_HANDLER,
  SUBCATEGORY_HANDLER,
  SUMMARY_HANDLER,
} from '@admin-back/core';
import { GRPCInterceptor, GrpcProviders } from '@admin-back/shared';
import {
  AccountResolver,
  BudgetResolver,
  CategoryResolver,
  MovementResolver,
  ScheduledResolver,
  SubcategoryResolver,
  SummaryResolver,
} from 'app/finances';

const Providers = GrpcProviders({
  providers: [
    ACCOUNT_HANDLER,
    CATEGORY_HANDLER,
    SUBCATEGORY_HANDLER,
    MOVEMENT_HANDLER,
    SUMMARY_HANDLER,
    BUDGET_HANDLER,
    SCHEDULED_HANDLER,
  ],
  client: FINANCES_GRPC_CLIENT,
});

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: FINANCES_GRPC_CLIENT,
        useFactory: (grpcInterceptor) => {
          return {
            transport: Transport.GRPC,
            options: {
              ...FinancesConfig,
              channelOptions: {
                interceptors: [
                  (options, nextCall) =>
                    grpcInterceptor.interceptGrpcCall(options, nextCall),
                ],
              },
            },
          };
        },
        inject: [GRPCInterceptor],
        extraProviders: [GRPCInterceptor],
      },
    ]),
  ],
  providers: [
    ...Providers,
    AccountResolver,
    CategoryResolver,
    SubcategoryResolver,
    MovementResolver,
    BudgetResolver,
    ScheduledResolver,
    SummaryResolver,
  ],
  exports: [
    ...Providers,
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
