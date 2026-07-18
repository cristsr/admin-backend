import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from '../account/account.module';
import { CategoryModule } from '../category/category.module';
import { MovementRepository } from './domain/movement';
import { MovementController } from './infrastructure/adapters/http';
import {
  TypeOrmMovementEntity,
  TypeOrmMovementRepository,
} from './infrastructure/adapters/persistence/typeorm/movement';
import {
  FindAllMovementsUsecase,
  FindMovementUsecase,
  RemoveMovementUsecase,
  SaveMovementUsecase,
  UpdateMovementUsecase,
} from './application/usecases';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmMovementEntity]),
    CategoryModule,
    AccountModule,
  ],
  controllers: [MovementController],
  providers: [
    { provide: MovementRepository, useClass: TypeOrmMovementRepository },
    FindMovementUsecase,
    FindAllMovementsUsecase,
    SaveMovementUsecase,
    UpdateMovementUsecase,
    RemoveMovementUsecase,
  ],
  exports: [MovementRepository],
})
export class MovementModule {}
