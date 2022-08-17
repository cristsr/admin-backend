import { Observable } from 'rxjs';
import {
  CreateSubcategories,
  CreateSubcategory,
  Status,
  Subcategories,
  Subcategory,
  UpdateSubcategory,
} from '@admin-back/grpc';
import { Id } from '../../types';

export interface SubcategoryGrpc {
  create(subcategory: CreateSubcategory): Observable<Subcategory>;

  createMany(subcategories: CreateSubcategories): Observable<Status>;

  findOne(id: Id): Observable<Subcategory>;

  findByCategory(category: Id): Observable<Subcategories>;

  update(subcategory: UpdateSubcategory): Observable<Subcategory>;

  remove(id: Id): Observable<Status>;
}
