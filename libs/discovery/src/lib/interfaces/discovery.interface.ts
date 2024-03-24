import { CallHandler, ModuleMetadata, Type } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface DiscoveryInterceptor<T = any, R = any> {
  intercept(
    req: unknown,
    next: CallHandler<T>
  ): Observable<R> | Promise<Observable<R>>;
}

export interface DiscoveryModuleOptionsFactory {
  create(): Promise<DiscoveryProvider> | DiscoveryProvider;
}

enum SchemaType {
  JSON,
  YAML,
}

export interface ApiProvider {
  name: string | symbol;
  api: {
    path: string;
    version?: string;
  };
  schema: {
    path: string;
    type: SchemaType;
  };
}

export interface DiscoveryProvider {
  url: string;
  provide: ApiProvider | ApiProvider[];
  extra?: {
    interceptors?: DiscoveryInterceptor[];
    retryAttempts?: number;
    retryDelay?: number;
  };
}

// Sync options
export interface DiscoveryProviderOptions extends DiscoveryProvider {
  name: string | symbol;
}

export type DiscoveryModuleOptions =
  | DiscoveryProviderOptions[]
  | {
      clients: DiscoveryProviderOptions[];
      isGlobal?: boolean;
    };

// Async options
export interface DiscoveryProviderAsyncOptions
  extends Pick<ModuleMetadata, 'imports' & 'providers'> {
  useClass?: Type<DiscoveryModuleOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<DiscoveryProvider> | DiscoveryProvider;
  inject?: any[];
  name: string | symbol;
}

export type DiscoveryModuleAsyncOptions =
  | DiscoveryProviderAsyncOptions[]
  | {
      clients: DiscoveryProviderAsyncOptions[];
      isGlobal?: boolean;
    };
