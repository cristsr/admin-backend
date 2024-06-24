import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  Id,
  MOVEMENT_HANDLER,
  Movement,
  MovementFilter,
  MovementHandler,
  MovementInput,
  Status,
} from '@core';
import { Observable } from 'rxjs';
import { MovementService } from 'app/movement/services';

@Controller()
export class MovementController implements MovementHandler {
  constructor(private movementService: MovementService) {}

  @GrpcMethod(MOVEMENT_HANDLER)
  findAll(filter: MovementFilter): Observable<Movement[]> {
    return this.movementService.findAll(filter);
  }

  @GrpcMethod(MOVEMENT_HANDLER)
  findOne(movementId: Id): Observable<Movement> {
    return this.movementService.findOne(movementId);
  }

  @GrpcMethod(MOVEMENT_HANDLER)
  save(input: MovementInput): Observable<Movement> {
    return this.movementService.save(input);
  }

  @GrpcMethod(MOVEMENT_HANDLER)
  remove(movementId: Id): Observable<Status> {
    return this.movementService.remove(movementId);
  }

  @GrpcMethod(MOVEMENT_HANDLER)
  removeAll() {
    return this.movementService.removeAll();
  }
}
