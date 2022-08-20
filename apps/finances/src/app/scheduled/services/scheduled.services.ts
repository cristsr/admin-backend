import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { from, Observable } from 'rxjs';
import { ScheduledHandler } from 'app/scheduled/handlers';
import {
  CreateScheduled,
  Id,
  Scheduled,
  ScheduledGrpc,
  Scheduleds,
  Status,
  UpdateScheduled,
} from '@admin-back/grpc';

@GrpcService('finances')
export class ScheduledServices implements ScheduledGrpc {
  constructor(private scheduledService: ScheduledHandler) {}

  @GrpcMethod()
  findOne(scheduled: Id): Observable<Scheduled> {
    return from(this.scheduledService.findOne(scheduled.id));
  }

  @GrpcMethod()
  findAll(): Observable<Scheduleds> {
    return from(this.scheduledService.findAll());
  }

  @GrpcMethod()
  create(scheduled: CreateScheduled): Observable<Scheduled> {
    return from(this.scheduledService.create(scheduled));
  }

  @GrpcMethod()
  update(scheduled: UpdateScheduled): Observable<Scheduled> {
    return from(this.scheduledService.update(scheduled));
  }

  @GrpcMethod()
  remove(scheduled: Id): Observable<Status> {
    return from(this.scheduledService.remove(scheduled.id));
  }
}
