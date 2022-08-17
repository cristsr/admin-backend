import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  GrpcProvider,
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
} from '@admin-back/grpc';
import { CategoryResolver, SubcategoryResolver } from 'app/finances/resolvers';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: FINANCES_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: FinancesConfig,
      },
    ]),
  ],
  providers: [
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
    CategoryResolver,
    SubcategoryResolver,
  ],
})
export class FinancesModule {}
