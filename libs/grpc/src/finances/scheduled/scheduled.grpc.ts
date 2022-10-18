import { Observable } from 'rxjs';
import {
  CreateScheduled,
  Empty,
  Id,
  Scheduled,
  ScheduledFilter,
  Scheduleds,
  Status,
  UpdateScheduled,
} from '@admin-back/grpc';

export interface ScheduledGrpc {
  findOne(id: Id): Observable<Scheduled>;

  findAll(filters: ScheduledFilter): Observable<Scheduleds>;

  create(data: CreateScheduled): Observable<Scheduled>;

  update(data: UpdateScheduled): Observable<Scheduled>;

  remove(id: Id): Observable<Status>;
}
