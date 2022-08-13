import { Module } from '@nestjs/common';
import { FinancesService } from './services/finances.service';
import { FinancesResolver } from './resolvers/finances.resolver';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  CATEGORY_SERVICE,
  CATEGORY_SERVICE_NAME,
  FINANCES_GRPC_CLIENT,
  SUBCATEGORY_SERVICE,
  SUBCATEGORY_SERVICE_NAME,
  BUDGET_SERVICE,
  BUDGET_SERVICE_NAME,
  FinancesConfig,
  GrpcProvider,
} from '@admin-back/grpc';
import { CategoryService } from './services/category/category.service';
import { CategoryResolver } from './resolvers/category/category.resolver';

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
      provide: BUDGET_SERVICE,
      service: BUDGET_SERVICE_NAME,
      client: FINANCES_GRPC_CLIENT,
    }),
    FinancesResolver,
    CategoryResolver,
    FinancesService,
    CategoryService,
  ],
})
export class FinancesModule {}
