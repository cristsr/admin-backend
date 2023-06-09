import { Id, Movement, MovementFilter, MovementInput, Status } from '../..';
import { Observable } from 'rxjs';

export interface MovementGrpc {
  findOne(id: Id): Observable<Movement>;

  findAll(filter: MovementFilter, ...args): Observable<Movement[]>;

  save(data: MovementInput): Observable<Movement>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
