import { Abstract, Type } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

interface GrpcProviderOptions {
  provide: string | Type | Abstract<any>;
  service: string;
  client?: string;
}

interface GrpcProvidersOptions {
  providers: GrpcProviderOptions[];
  client: string;
}

export function GrpcProvider(options: GrpcProviderOptions) {
  return {
    provide: options.provide,
    useFactory: (client: ClientGrpc) => client.getService(options.service),
    inject: [options.client],
  };
}

export function GrpcProviders(options: GrpcProvidersOptions) {
  return options.providers.map((opt) =>
    GrpcProvider({
      provide: opt.provide,
      service: opt.service,
      client: options.client,
    })
  );
}
