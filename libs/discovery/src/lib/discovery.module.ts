import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';

@Module({
  controllers: [],
  providers: [HttpModule],
  exports: [],
})
export class DiscoveryModule {
  static registerAsync(): DynamicModule {
    return {
      module: DiscoveryModule,
      global: true,
      imports: [],
      providers: [],
      exports: [],
    };
  }
}
