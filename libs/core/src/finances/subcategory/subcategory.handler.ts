import { Observable } from 'rxjs';
import { Id, Status } from '../../shared';
import {
  CreateSubcategories,
  Subcategory,
  SubcategoryInput,
} from '../subcategory';

export abstract class SubcategoryHandler {
  abstract findOne(id: Id): Observable<Subcategory>;

  abstract findByCategory(category: Id): Observable<Subcategory[]>;

  abstract save(subcategory: SubcategoryInput): Observable<Subcategory>;

  abstract saveMany(subcategories: CreateSubcategories): Observable<Status>;

  abstract remove(id: Id): Observable<Status>;
}
