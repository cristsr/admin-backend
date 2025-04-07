import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { BudgetEntity } from 'app/modules/budget/entities';

@Injectable()
export class BudgetRepository extends EntityRepository(BudgetEntity) {}
