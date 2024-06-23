import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';
import { CategoryEntity } from 'app/category/entities';

@Injectable()
export class CategoryRepository extends EntityRepository(CategoryEntity) {}
