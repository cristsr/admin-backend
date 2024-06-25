import { Observable } from 'rxjs';

export type Empty = Record<string, never>;

export interface Id {
  id: number;
}

export type AsyncResult<T> = Promise<T> | Observable<T> | T;
