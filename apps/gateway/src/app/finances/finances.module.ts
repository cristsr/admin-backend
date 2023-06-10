import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GRPCInterceptor, GrpcProvider } from '@admin-back/shared';
import {
  FinancesConfig,
  FINANCES_GRPC_CLIENT,
  CATEGORY_SERVICE,
  CATEGORY_SERVICE_NAME,
  SUBCATEGORY_SERVICE,
  SUBCATEGORY_SERVICE_NAME,
  BUDGET_SERVICE,
  BUDGET_SERVICE_NAME,
  MOVEMENT_SERVICE,
  MOVEMENT_SERVICE_NAME,
  SUMMARY_SERVICE,
  SUMMARY_SERVICE_NAME,
  SCHEDULED_SERVICE,
  SCHEDULED_SERVICE_NAME,
  ACCOUNT_SERVICE,
  ACCOUNT_SERVICE_NAME,
} from '@admin-back/grpc';
import {
  AccountResolver,
  CategoryResolver,
  SubcategoryResolver,
  MovementResolver,
  BudgetResolver,
  ScheduledResolver,
  SummaryResolver,
} from 'app/finances/resolvers';

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
    GrpcProvider({
      provide: ACCOUNT_SERVICE,
      service: ACCOUNT_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
    GrpcProvider({
      provide: CATEGORY_SERVICE,
      service: CATEGORY_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
    GrpcProvider({
      provide: SUBCATEGORY_SERVICE,
      service: SUBCATEGORY_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
    GrpcProvider({
      provide: MOVEMENT_SERVICE,
      service: MOVEMENT_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
    GrpcProvider({
      provide: SUMMARY_SERVICE,
      service: SUMMARY_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
    GrpcProvider({
      provide: BUDGET_SERVICE,
      service: BUDGET_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
    GrpcProvider({
      provide: SCHEDULED_SERVICE,
      service: SCHEDULED_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
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
