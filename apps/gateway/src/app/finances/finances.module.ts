import { Inject, Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesResolver } from './finances.resolver';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import { FINANCES_GRPC_CLIENT, FinancesConfig } from '@admin-back/grpc';

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
    // GrpcProvider(CATEGORY_SERVICE, CATEGORY_SERVICE_NAME, CATEGORY_GRPC_CLIENT),
    // GrpcProvider(FINANCES_SERVICE, FINANCES_SERVICE_NAME, FINANCES_GRPC_CLIENT),
    // GrpcProvider('CategoryService', 'CategoryService', FINANCES_GRPC_CLIENT),
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
