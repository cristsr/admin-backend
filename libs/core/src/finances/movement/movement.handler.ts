import { Observable } from 'rxjs';
import { Id, Movement, MovementFilter, MovementInput, Status } from '../..';

export abstract class MovementHandler {
  abstract findOne(id: Id): Promise<Movement> | Observable<Movement>;

  abstract findAll(filter: MovementFilter): Promise<Movement[]>;

  abstract save(data: MovementInput): Observable<Movement>;

  abstract remove(id: Id): Promise<Status> | Observable<Status>;

  abstract removeAll(): Promise<Status> | Observable<Status>;
}
