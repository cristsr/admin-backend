import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Scheduled, ScheduledFilter, ScheduledInput, User } from '@core';
import { CurrentUser } from '@shared';
import { Observable } from 'rxjs';
import { ScheduledService } from 'app/modules/scheduled/services';

@Controller('scheduled')
export class ScheduledController {
  constructor(private scheduledService: ScheduledService) {}

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: number) {
    return this.scheduledService.findOne({ id, user: user.id });
  }

  @Get()
  findAll(@Query() filter: ScheduledFilter) {
    return this.scheduledService.findAll(filter);
  }

  @Post()
  save(@Body() input: ScheduledInput): Observable<Scheduled> {
    return this.scheduledService.save(input);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: number) {
    return this.scheduledService.remove({ id, user: user.id });
  }
}
