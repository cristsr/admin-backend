import { ClientGrpc } from '@nestjs/microservices';

interface GrpcProviderOptions {
  provide: string;
  service: string;
  client?: string;
}

interface GrpcProvidersOptions {
  providers: string[];
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
  return options.providers.map((provider) =>
    GrpcProvider({
      provide: provider,
      service: provider,
      client: options.client,
    })
  );
}
