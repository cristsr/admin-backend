import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Movement, MovementFilter, MovementInput, User } from '@core';
import { CurrentUser } from '@shared';
import { Observable } from 'rxjs';
import { MovementService } from 'app/modules/movement/services';

@Controller('movements')
export class MovementController {
  constructor(private movementService: MovementService) {}

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: number) {
    return this.movementService.findOne({ id, user: user.id });
  }

  @Get()
  findAll(@Query() filter: MovementFilter): Promise<Movement[]> {
    return this.movementService.findAll(filter);
  }

  @Post()
  save(@Body() input: MovementInput): Observable<Movement> {
    return this.movementService.save(input);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: number) {
    return this.movementService.remove({ id });
  }
}
