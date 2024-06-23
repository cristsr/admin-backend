import { Observable } from 'rxjs';
import { Id, Scheduled, ScheduledFilter, ScheduledInput, Status } from '../..';

export interface ScheduledGrpc {
  findOne(id: Id): Observable<Scheduled>;

  findAll(filter: ScheduledFilter): Observable<Scheduled[]>;

  save(data: ScheduledInput): Observable<Scheduled>;

  remove(id: Id): Observable<Status>;
}
