import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  Id,
  MOVEMENT_HANDLER,
  Movement,
  MovementFilter,
  MovementHandler,
  MovementInput,
  Status,
} from '@admin-back/core';
import { MovementService } from 'app/movement/services';

@Controller('finances')
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
