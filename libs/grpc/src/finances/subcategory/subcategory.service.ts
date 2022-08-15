import { Observable } from 'rxjs';
import {
  CreateSubcategory,
  Subcategory,
  UpdateSubcategory,
} from '@admin-back/grpc';
import { Empty, Id } from '../../types';

export interface SubcategoryService {
  create(data: CreateSubcategory): Observable<Subcategory>;
  findOne(id: Id): Observable<Subcategory>;
  findByCategory(id: Id): Observable<Subcategory[]>;
  update(data: UpdateSubcategory): Observable<Subcategory>;
  remove(id: Id): Observable<Empty>;
}
