import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { MovementService } from 'app/movement/services';
import {
  CreateMovementDto,
  MovementDto,
  MovementQueryDto,
  UpdateMovementDto,
} from 'app/movement/dto';

@Controller({
  path: 'movements',
  version: '1',
})
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Post()
  create(@Body() createMovementDto: CreateMovementDto) {
    return this.movementService.create(createMovementDto);
  }

  /**
   * Todo: Replace finAll to post request to allow nested objects
   * @param params
   */
  @Get()
  findAll(@Query() params: MovementQueryDto): Promise<MovementDto[]> {
    return this.movementService.findAll(params);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.movementService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMovementDto: UpdateMovementDto
  ) {
    return this.movementService.update(id, updateMovementDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.movementService.remove(id);
  }

  @Delete()
  removeAll() {
    return this.movementService.removeAll();
  }
}
