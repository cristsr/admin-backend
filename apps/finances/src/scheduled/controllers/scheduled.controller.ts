import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  Id,
  SCHEDULED_HANDLER,
  Scheduled,
  ScheduledFilter,
  ScheduledHandler,
  ScheduledInput,
  Status,
} from '@admin-back/core';
import { ScheduledService } from 'app/scheduled/services';

@Controller()
export class ScheduledController implements ScheduledHandler {
  constructor(private scheduledService: ScheduledService) {}

  @GrpcMethod(SCHEDULED_HANDLER)
  findOne(scheduledId: Id): Observable<Scheduled> {
    return this.scheduledService.findOne(scheduledId);
  }

  @GrpcMethod(SCHEDULED_HANDLER)
  findAll(filter: ScheduledFilter): Observable<Scheduled[]> {
    return this.scheduledService.findAll(filter);
  }

  @GrpcMethod(SCHEDULED_HANDLER)
  save(input: ScheduledInput): Observable<Scheduled> {
    return this.scheduledService.save(input);
  }

  @GrpcMethod(SCHEDULED_HANDLER)
  remove(scheduledId: Id): Observable<Status> {
    return this.scheduledService.remove(scheduledId);
  }
}
