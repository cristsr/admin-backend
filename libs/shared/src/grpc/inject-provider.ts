import { ClientGrpc } from '@nestjs/microservices';

export function GrpcProvider(
  provide: string,
  serviceName: string,
  grpClientToken: string
) {
  return {
    provide,
    useFactory: (client: ClientGrpc) => client.getService(serviceName),
    inject: [grpClientToken],
  };
}
