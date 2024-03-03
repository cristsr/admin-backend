import { Observable } from 'rxjs';
import { Id, Movement, MovementFilter, MovementInput, Status } from '../..';

export interface MovementGrpc {
  findOne(id: Id): Observable<Movement>;

  findAll(filter: MovementFilter, ...args): Observable<Movement[]>;

  save(data: MovementInput): Observable<Movement>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
