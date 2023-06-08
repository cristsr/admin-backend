import { Observable } from 'rxjs';
import { Category, CategoriesInput, CategoryInput, Status, Id } from '../..';

export interface CategoryGrpc {
  findOne(id: Id): Observable<Category>;

  findAll(): Observable<Category[]>;

  save(data: CategoryInput): Observable<Category>;

  saveMany(data: CategoriesInput): Observable<Status>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
