import {
  Id,
  Movement,
  Movements,
  MovementFilter,
  MovementInput,
  UpdateMovement,
  Status,
} from '@admin-back/grpc';
import { Observable } from 'rxjs';

export interface MovementGrpc {
  findOne(id: Id): Observable<Movement>;

  findAll(filters: MovementFilter): Observable<Movements>;

  save(data: MovementInput): Observable<Movement>;

  update(data: UpdateMovement): Observable<Movement>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
