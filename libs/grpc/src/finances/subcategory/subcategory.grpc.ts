import { Observable } from 'rxjs';
import {
  CreateSubcategories,
  SubcategoryInput,
  Status,
  Subcategory,
  Id,
} from '@admin-back/grpc';

export interface SubcategoryGrpc {
  findOne(id: Id): Observable<Subcategory>;

  findByCategory(category: Id): Observable<Subcategory[]>;

  save(subcategory: SubcategoryInput): Observable<Subcategory>;

  saveMany(subcategories: CreateSubcategories): Observable<Status>;

  remove(id: Id): Observable<Status>;
}
