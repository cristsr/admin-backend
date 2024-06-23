import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';
import { BudgetEntity } from 'app/budget/entities';

@Injectable()
export class BudgetRepository extends EntityRepository(BudgetEntity) {}
