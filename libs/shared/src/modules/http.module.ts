import { HttpModule, HttpModuleOptions, HttpService } from '@nestjs/axios';
import { HttpModuleOptionsFactory } from '@nestjs/axios/dist/interfaces/http-module.interface';
import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';

// Interfaces split following the interface segregation principle
export interface HttpOptions extends HttpModuleOptions {
  name: string;
}

export interface HttpAsyncOptionsBase extends Pick<ModuleMetadata, 'imports'> {
  name: string;
  inject?: any[];
  extraProviders?: Provider[];
}

export interface HttpAsyncOptionsFactoryClass extends HttpAsyncOptionsBase {
  useClass: Type<HttpModuleOptionsFactory>;
  useExisting?: never;
  useFactory?: never;
}

export interface HttpAsyncOptionsFactoryExisting extends HttpAsyncOptionsBase {
  useExisting: Type<HttpModuleOptionsFactory>;
  useClass?: never;
  useFactory?: never;
}

export interface HttpAsyncOptionsFactory extends HttpAsyncOptionsBase {
  useFactory: (
    ...args: any[]
  ) => Promise<HttpModuleOptions> | HttpModuleOptions;
  useExisting?: never;
  useClass?: never;
}

export type HttpAsyncOptions =
  | HttpAsyncOptionsFactoryClass
  | HttpAsyncOptionsFactoryExisting
  | HttpAsyncOptionsFactory;

// Factory that creates providers following the single responsibility principle
class HttpProviderFactory {
  static createNamedHttpServiceProvider(name: string): Provider {
    return {
      provide: name,
      useExisting: HttpService,
    };
  }
}

@Module({})
export class ApiModule {
  static register({ name, ...options }: HttpOptions): DynamicModule {
    return {
      module: ApiModule,
      imports: [HttpModule.register(options)],
      providers: [HttpProviderFactory.createNamedHttpServiceProvider(name)],
      exports: [name],
    };
  }

  static registerAsync(asyncOptions: HttpAsyncOptions): DynamicModule {
    const { name, ...options } = asyncOptions;

    return {
      module: ApiModule,
      imports: [
        ...(options.imports ?? []),
        HttpModule.registerAsync({
          useExisting:
            'useExisting' in options ? options.useExisting : undefined,
          useClass: 'useClass' in options ? options.useClass : undefined,
          useFactory: 'useFactory' in options ? options.useFactory : undefined,
          inject: options.inject ?? [],
        }),
      ],
      providers: [
        ...(options.extraProviders ?? []),
        HttpProviderFactory.createNamedHttpServiceProvider(name),
      ],
      exports: [name],
    };
  }
}
