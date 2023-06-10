import { ClientGrpc } from '@nestjs/microservices';

interface GrpcProviderOptions {
  provide: string;
  service: string;
  client: string;
}

export function GrpcProvider(options: GrpcProviderOptions) {
  return {
    provide: options.provide,
    useFactory: async (client: ClientGrpc) =>
      client.getService(options.service),
    inject: [options.client],
  };
}
