import { Observable } from 'rxjs';
import {
  ScheduledInput,
  Id,
  Scheduled,
  ScheduledFilter,
  Status,
} from '@admin-back/grpc';

export interface ScheduledGrpc {
  findOne(id: Id): Observable<Scheduled>;

  findAll(filter: ScheduledFilter): Observable<Scheduled[]>;

  save(data: ScheduledInput): Observable<Scheduled>;

  remove(id: Id): Observable<Status>;
}
