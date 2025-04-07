import { Observable } from 'rxjs';
import { CategoriesInput, Category, CategoryInput, Id, Status } from '../..';

export abstract class CategoryHandler {
  abstract findOne(id: Id): Promise<Category> | Observable<Category>;

  abstract findAll(): Promise<Category[]> | Observable<Category[]>;

  abstract save(data: CategoryInput): Observable<Category>;

  abstract saveMany(data: CategoriesInput): Observable<Status>;

  abstract remove(id: Id): Promise<Status> | Observable<Status>;

  abstract removeAll(): Promise<Status> | Observable<Status>;
}
