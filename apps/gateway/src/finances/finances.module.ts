import { Module } from '@nestjs/common';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import {
  ACCOUNT_HANDLER,
  AccountHandler,
  BUDGET_HANDLER,
  BudgetHandler,
  CATEGORY_HANDLER,
  CategoryHandler,
  FINANCES_GRPC_CLIENT,
  FinancesConfig,
  MOVEMENT_HANDLER,
  MovementHandler,
  SCHEDULED_HANDLER,
  SUBCATEGORY_HANDLER,
  SUMMARY_HANDLER,
  ScheduledHandler,
  SubcategoryHandler,
  SummaryHandler,
} from '@core';
import { GRPCInterceptor, GrpcProviders } from '@shared';
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
    { provide: AccountHandler, service: ACCOUNT_HANDLER },
    { provide: CategoryHandler, service: CATEGORY_HANDLER },
    { provide: SubcategoryHandler, service: SUBCATEGORY_HANDLER },
    { provide: MovementHandler, service: MOVEMENT_HANDLER },
    { provide: SummaryHandler, service: SUMMARY_HANDLER },
    { provide: BudgetHandler, service: BUDGET_HANDLER },
    { provide: ScheduledHandler, service: SCHEDULED_HANDLER },
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
    {
      provide: AccountHandler,
      useFactory: (client: ClientGrpc) => client.getService(ACCOUNT_HANDLER),
      inject: [FINANCES_GRPC_CLIENT],
    },
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
