import { Observable } from 'rxjs';
import { CategoriesInput, Category, CategoryInput, Id, Status } from '../..';

export abstract class CategoryHandler {
  abstract findOne(id: Id): Observable<Category>;

  abstract findAll(): Observable<Category[]>;

  abstract save(data: CategoryInput): Observable<Category>;

  abstract saveMany(data: CategoriesInput): Observable<Status>;

  abstract remove(id: Id): Observable<Status>;

  abstract removeAll(): Observable<Status>;
}
