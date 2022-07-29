import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Auth } from 'auth/controllers';
import { AuthService } from 'auth/services';
import { UserEntity } from 'auth/entities';
import { AUTH_STRATEGIES } from 'auth/types';
import { AuthStrategies } from 'auth/strategies';
import { Type } from '@nestjs/common';

export interface StrategyConfig {
  strategies: Record<any, Type>;
  provide: string;
  multi?: boolean;
}

export function StrategyRegister(config: StrategyConfig) {
  const strategies = Object.values(config.strategies);

  return [
    ...strategies,
    {
      provide: config.provide,
      useFactory: (...steps) => steps,
      inject: strategies,
      multi: config.multi || false,
    },
  ];
}

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([UserEntity])],
  controllers: [Auth],
  providers: [
    AuthService,
    ...StrategyRegister({
      provide: AUTH_STRATEGIES,
      strategies: AuthStrategies,
    }),
  ],
})
export class AuthModule {}
