import { Inject, Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesResolver } from './finances.resolver';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
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
import { join } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: CATEGORY_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: CategoryConfig,
      },
      {
        name: FINANCES_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: 'finances',
          protoPath: join(__dirname, 'assets', 'finances', 'finances.proto'),
          loader: {
            includeDirs: [join(__dirname, 'assets', 'finances')],
          },
        },
      },
    ]),
  ],
  providers: [
    GrpcProvider(CATEGORY_SERVICE, CATEGORY_SERVICE_NAME, CATEGORY_GRPC_CLIENT),
    // GrpcProvider(FINANCES_SERVICE, FINANCES_SERVICE_NAME, FINANCES_GRPC_CLIENT),
    GrpcProvider('CategoryService', 'CategoryService', FINANCES_GRPC_CLIENT),
    FinancesResolver,
    FinancesService,
  ],
})
export class FinancesModule {
  constructor(
    @Inject(FINANCES_GRPC_CLIENT) private readonly financesClient: ClientGrpc
  ) {
    console.log('FinancesModule');
    console.log(financesClient);
  }
}
