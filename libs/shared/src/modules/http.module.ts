import { HttpService } from '@nestjs/axios';
import { ConfigurableModuleBuilder, Module, Provider } from '@nestjs/common';
import axios, { CreateAxiosDefaults } from 'axios';
import { ApiModuleExtras } from './api-module-extras.type';

/** How the axios instance behind a named client is configured. */
export type ApiClientOptions = CreateAxiosDefaults;

export const API_CLIENT_OPTIONS = 'API_CLIENT_OPTIONS';

/** A named HTTP client as a plain provider, fed by the module's own config. */
export function createApiClientProvider<T>(client: {
  provide: string;
  inject: any[];
  useFactory: (...args: T[]) => ApiClientOptions;
}): Provider {
  return {
    provide: client.provide,
    useFactory: (...args: T[]) => new HttpService(axios.create(client.useFactory(...args))),
    inject: client.inject,
  };
}

const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<ApiClientOptions>({
  optionsInjectionToken: API_CLIENT_OPTIONS,
})
  .setClassMethodName('register')
  .setExtras<ApiModuleExtras>({ name: '' }, (definition, extras) => ({
    ...definition,
    providers: [
      ...(definition.providers ?? []),
      {
        provide: extras.name,
        // Own axios instance: a named client's baseURL and timeouts stay independent.
        useFactory: (options: ApiClientOptions) => new HttpService(axios.create(options)),
        inject: [API_CLIENT_OPTIONS],
      },
    ],
    exports: [extras.name],
  }))
  .build();

@Module({})
export class ApiModule extends ConfigurableModuleClass {}
