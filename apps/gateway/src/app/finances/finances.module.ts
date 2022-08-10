import { Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesResolver } from './finances.resolver';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  CATEGORY_GRPC_CLIENT,
  CATEGORY_SERVICE,
  CATEGORY_SERVICE_NAME,
  CategoryConfig,
  FINANCES_GRPC_CLIENT,
  FINANCES_SERVICE,
  FINANCES_SERVICE_NAME,
  FinancesConfig,
} from '@admin-back/grpc';
import { GrpcProvider } from '@admin-back/shared';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: CATEGORY_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: CategoryConfig,
      },
    ]),
  ],
  providers: [
    GrpcProvider(CATEGORY_SERVICE, CATEGORY_SERVICE_NAME, CATEGORY_GRPC_CLIENT),
    FinancesResolver,
    FinancesService,
  ],
})
export class FinancesModule {}
