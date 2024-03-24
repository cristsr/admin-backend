import { Type } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ObjectLiteral } from '../types';

export interface RepositoryOptions<T> {
  name: string;
  entity: Type<T>;
}

export interface Repository<T> {
  find<F = ObjectLiteral>(filter: F): Observable<T[]>;
  findOne<F = ObjectLiteral>(filter: F): Observable<T>;
  findById(id: number): Observable<T>;
  save(data: T): Observable<T>;
  delete(id: number): Observable<T>;
}
