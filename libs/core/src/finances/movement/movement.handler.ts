import { Observable } from 'rxjs';
import { Id, Movement, MovementFilter, MovementInput, Status } from '../..';

export interface MovementHandler {
  findOne(id: Id): Observable<Movement>;

  findAll(filter: MovementFilter): Observable<Movement[]>;

  save(data: MovementInput): Observable<Movement>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
