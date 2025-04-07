import { Observable } from 'rxjs';
import { Id, Scheduled, ScheduledFilter, ScheduledInput, Status } from '../..';

export abstract class ScheduledHandler {
  abstract findOne(id: Id): Promise<Scheduled> | Observable<Scheduled>;

  abstract findAll(
    filter: ScheduledFilter,
  ): Promise<Scheduled[]> | Observable<Scheduled[]>;

  abstract save(data: ScheduledInput): Observable<Scheduled>;

  abstract remove(id: Id): Promise<Status> | Observable<Status>;
}
