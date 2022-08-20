import { Body, Param } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { ScheduledHandler } from 'app/scheduled/handlers';
import { CreateScheduled } from 'app/scheduled/dto';

@GrpcService('finances')
export class ScheduledServices {
  constructor(private scheduledService: ScheduledHandler) {}

  @GrpcMethod()
  create(@Body() data: CreateScheduled) {
    return this.scheduledService.create(data);
  }

  @GrpcMethod()
  findAll() {
    return this.scheduledService.findAll();
  }

  @GrpcMethod()
  findOne(@Param('id') id: string) {
    return this.scheduledService.findOne(+id);
  }

  @GrpcMethod()
  update(@Param('id') id: string, @Body() data: CreateScheduled) {
    return this.scheduledService.update(+id, data);
  }

  @GrpcMethod()
  remove(@Param('id') id: string) {
    return this.scheduledService.remove(+id);
  }
}
