import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { SubcategoryEntity } from 'app/modules/subcategory/entities';

@Injectable()
export class SubcategoryRepository extends EntityRepository(
  SubcategoryEntity,
) {}
