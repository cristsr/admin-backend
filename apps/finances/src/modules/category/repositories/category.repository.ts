import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { CategoryEntity } from 'app/modules/category/entities';

@Injectable()
export class CategoryRepository extends EntityRepository(CategoryEntity) {}
