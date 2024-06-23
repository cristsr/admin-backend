import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';
import { SubcategoryEntity } from 'app/subcategory/entities';

@Injectable()
export class SubcategoryRepository extends EntityRepository(
  SubcategoryEntity
) {}
