import { Observable } from 'rxjs';
import { CreateSubcategory, Subcategory } from '../subcategory';

export interface CategoryService {
  create(data: CreateCategory): Observable<Category>;
  createMany(data: CreateCategory[]): Observable<Category[]>;
  findOne(id: CategoryId): Observable<Category>;
  findAll(): Observable<Category[]>;
  update(data: UpdateCategory): Observable<Category>;
  remove(id: CategoryId): Observable<CategoryId>;
  removeAll(): Observable<void>;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  subcategories: Subcategory[];
}

export interface CreateCategory extends Omit<Category, 'id' | 'subcategories'> {
  subcategories?: CreateSubcategory[];
}

export interface UpdateCategory extends Partial<CreateCategory> {
  id: number;
}

export interface CategoryId {
  id: number;
}
