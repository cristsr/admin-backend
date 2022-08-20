import { MovementHandler } from 'app/movement/handlers';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { from, Observable } from 'rxjs';
import {
  CreateMovement,
  Id,
  Movement,
  MovementFilter,
  MovementGrpc,
  Movements,
  Status,
  UpdateMovement,
} from '@admin-back/grpc';

@GrpcService('finances')
export class MovementService implements MovementGrpc {
  constructor(private readonly movementHandler: MovementHandler) {}

  @GrpcMethod()
  create(movement: CreateMovement): Observable<Movement> {
    return from(this.movementHandler.create(movement));
  }

  @GrpcMethod()
  findOne(movement: Id): Observable<Movement> {
    return from(this.movementHandler.findOne(movement.id));
  }

  @GrpcMethod()
  findAll(filters: MovementFilter): Observable<Movements> {
    return from(this.movementHandler.findAll(filters));
  }

  @GrpcMethod()
  update(movement: UpdateMovement): Observable<Movement> {
    return from(this.movementHandler.update(movement));
  }

  @GrpcMethod()
  remove(movement: Id): Observable<Status> {
    return from(this.movementHandler.remove(movement.id));
  }

  @GrpcMethod()
  removeAll() {
    return from(this.movementHandler.removeAll());
  }
}
