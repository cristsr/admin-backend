import { Observable } from 'rxjs';
import { CategoriesInput, Category, CategoryInput, Id, Status } from '../..';

export interface CategoryGrpc {
  findOne(id: Id): Observable<Category>;

  findAll(): Observable<Category[]>;

  save(data: CategoryInput): Observable<Category>;

  saveMany(data: CategoriesInput): Observable<Status>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
