import { Observable } from 'rxjs';
import { Id, Scheduled, ScheduledFilter, ScheduledInput, Status } from '../..';

export abstract class ScheduledHandler {
  abstract findOne(id: Id): Observable<Scheduled>;

  abstract findAll(filter: ScheduledFilter): Observable<Scheduled[]>;

  abstract save(data: ScheduledInput): Observable<Scheduled>;

  abstract remove(id: Id): Observable<Status>;
}
