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

/**
 * AC-4 (sm-0003) — user-defined auto-categorization rules and the matcher that
 * applies them. Exports the category resolver so movement ingestion (webhook
 * and manual) settles the category of every incoming movement the same way.
 */
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
