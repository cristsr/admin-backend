import { Observable } from 'rxjs';
import {
  Category,
  CategoriesInput,
  CategoryInput,
  Status,
  Id,
  List,
} from '@admin-back/grpc';

export interface CategoryGrpc {
  findOne(id: Id): Observable<Category>;

  findAll(): Observable<List<Category>>;

  save(data: CategoryInput): Observable<Category>;

  saveMany(data: CategoriesInput): Observable<Status>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
