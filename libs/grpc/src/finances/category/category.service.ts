import { Observable } from 'rxjs';
import {
  Category,
  CreateCategories,
  CreateCategory,
  UpdateCategory,
} from './category.dto';
import { Empty, Id, List } from '../../types';

export interface CategoryService {
  create(data: CreateCategory): Observable<Category>;
  createMany(data: CreateCategories): Observable<Category[]>;
  findOne(id: Id): Observable<Category>;
  findAll(): Observable<List<Category>>;
  update(data: UpdateCategory): Observable<Category>;
  remove(id: Id): Observable<Empty>;
  removeAll(): Observable<Empty>;
}
