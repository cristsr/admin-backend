import { Observable } from 'rxjs';
import { Id, Status } from '../../shared';
import {
  CreateSubcategories,
  Subcategory,
  SubcategoryInput,
} from '../subcategory';

export interface SubcategoryGrpc {
  findOne(id: Id): Observable<Subcategory>;

  findByCategory(category: Id): Observable<Subcategory[]>;

  save(subcategory: SubcategoryInput): Observable<Subcategory>;

  saveMany(subcategories: CreateSubcategories): Observable<Status>;

  remove(id: Id): Observable<Status>;
}
