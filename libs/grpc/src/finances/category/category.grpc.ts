import { Observable } from 'rxjs';
import {
  Category,
  CreateCategories,
  CreateCategory,
  UpdateCategory,
  Status,
  Id,
  List,
} from '@admin-back/grpc';

export interface CategoryGrpc {
  create(data: CreateCategory): Observable<Category>;

  createMany(data: CreateCategories): Observable<Status>;

  findOne(id: Id): Observable<Category>;

  findAll(): Observable<List<Category>>;

  update(data: UpdateCategory): Observable<Category>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
