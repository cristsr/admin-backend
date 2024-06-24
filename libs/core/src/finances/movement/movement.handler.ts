import { Observable } from 'rxjs';
import { Id, Movement, MovementFilter, MovementInput, Status } from '../..';

export abstract class MovementHandler {
  abstract findOne(id: Id): Observable<Movement>;

  abstract findAll(filter: MovementFilter): Observable<Movement[]>;

  abstract save(data: MovementInput): Observable<Movement>;

  abstract remove(id: Id): Observable<Status>;

  abstract removeAll(): Observable<Status>;
}
