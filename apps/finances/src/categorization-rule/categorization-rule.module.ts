import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from '../category/category.module';
import {
  CreateCategorizationRuleUsecase,
  FindAllCategorizationRulesUsecase,
  RemoveCategorizationRuleUsecase,
  UpdateCategorizationRuleUsecase,
} from './application/usecases';
import {
  CategorizationRuleRepository,
  CategorizationService,
  CategoryResolver,
} from './domain/categorization-rule';
import { CategorizationRuleController } from './infrastructure/adapters/http';
import {
  TypeOrmCategorizationRuleEntity,
  TypeOrmCategorizationRuleRepository,
} from './infrastructure/adapters/persistence/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmCategorizationRuleEntity]),
    CategoryModule,
  ],
  controllers: [CategorizationRuleController],
  providers: [
    {
      provide: CategorizationRuleRepository,
      useClass: TypeOrmCategorizationRuleRepository,
    },
    CreateCategorizationRuleUsecase,
    FindAllCategorizationRulesUsecase,
    UpdateCategorizationRuleUsecase,
    RemoveCategorizationRuleUsecase,
    CategorizationService,
    CategoryResolver,
  ],
  exports: [CategoryResolver],
})
export class CategorizationRuleModule {}
