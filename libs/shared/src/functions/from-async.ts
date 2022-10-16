import { from, Observable } from 'rxjs';

export function fromAsync<T>(fn: () => Promise<T>): Observable<T> {
  return from(fn());
}
