import {
  Id,
  Movement,
  Movements,
  MovementFilter,
  CreateMovement,
  UpdateMovement,
  Status,
} from '@admin-back/grpc';
import { Observable } from 'rxjs';

export interface MovementGrpc {
  findOne(id: Id): Observable<Movement>;

  findAll(filter: MovementFilter): Observable<Movements>;

  create(data: CreateMovement): Observable<Movement>;

  update(data: UpdateMovement): Observable<Movement>;

  remove(id: Id): Observable<Status>;

  removeAll(): Observable<Status>;
}
