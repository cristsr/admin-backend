import { Observable } from 'rxjs';
import { CategoryId } from '@admin-back/grpc';

export interface SubcategoryService {
  create(data: CreateSubcategory): Observable<Subcategory>;
  findOne(id: SubcategoryId): Observable<Subcategory>;
  findAllByCategory(id: CategoryId): Observable<Subcategory[]>;
  update(data: UpdateSubcategory): Observable<Subcategory>;
  remove(id: SubcategoryId): Observable<SubcategoryId>;
}

export interface Subcategory {
  id: number;
  name: string;
}

export interface SubcategoryId {
  id: number;
}

export type CreateSubcategory = Omit<Subcategory, 'id'>;

export type UpdateSubcategory = Partial<Subcategory>;
