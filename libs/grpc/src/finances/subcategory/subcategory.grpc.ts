import { Observable } from 'rxjs';
import {
  CreateSubcategories,
  SubcategoryInput,
  Status,
  Subcategories,
  Subcategory,
  Id,
} from '@admin-back/grpc';

export interface SubcategoryGrpc {
  findOne(id: Id): Observable<Subcategory>;

  findByCategory(category: Id): Observable<Subcategories>;

  save(subcategory: SubcategoryInput): Observable<Subcategory>;

  saveMany(subcategories: CreateSubcategories): Observable<Status>;

  remove(id: Id): Observable<Status>;
}
