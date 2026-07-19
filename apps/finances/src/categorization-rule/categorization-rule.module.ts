import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from '../category/category.module';
import { CategorizationRuleRepository } from './domain/categorization-rule';
import {
  ApplyCategorizationRulesUsecase,
  CreateCategorizationRuleUsecase,
  FindAllCategorizationRulesUsecase,
  RemoveCategorizationRuleUsecase,
  UpdateCategorizationRuleUsecase,
} from './application/usecases';
import { CategorizationRuleController } from './infrastructure/adapters/http';
import {
  TypeOrmCategorizationRuleEntity,
  TypeOrmCategorizationRuleRepository,
} from './infrastructure/adapters/persistence/typeorm';

/**
 * AC-4 (sm-0003) — user-defined auto-categorization rules and the matcher that
 * applies them. Exports the apply use case so movement ingestion (webhook and
 * manual) can categorize movements that arrive without a category.
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
    ApplyCategorizationRulesUsecase,
  ],
  exports: [ApplyCategorizationRulesUsecase],
})
export class CategorizationRuleModule {}
