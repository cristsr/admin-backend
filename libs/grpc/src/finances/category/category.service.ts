import { Observable } from 'rxjs';
import {
  Category,
  CreateCategories,
  CreateCategory,
  UpdateCategory,
} from './category.dto';
import { Id, List } from '../../types';
import { Status } from '../../shared';

export interface CategoryService {
  create(data: CreateCategory): Observable<Category>;
  createMany(data: CreateCategories): Observable<Status>;
  findOne(id: Id): Observable<Category>;
  findAll(): Observable<List<Category>>;
  update(data: UpdateCategory): Observable<Category>;
  remove(id: Id): Observable<Status>;
  removeAll(): Observable<Status>;
}
