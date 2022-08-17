import { Observable } from 'rxjs';
import {
  CreateSubcategories,
  CreateSubcategory,
  Status,
  Subcategories,
  Subcategory,
  UpdateSubcategory,
} from '@admin-back/grpc';
import { Empty, Id } from '../../types';

export interface SubcategoryService {
  create(data: CreateSubcategory): Observable<Subcategory>;
  createMany(data: CreateSubcategories): Observable<Status>;
  findOne(id: Id): Observable<Subcategory>;
  findMany(data: CreateSubcategories): Observable<Status>;
  findByCategory(id: Id): Observable<Subcategories>;
  update(data: UpdateSubcategory): Observable<Subcategory>;
  remove(id: Id): Observable<Empty>;
}
