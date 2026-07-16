import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
import {
  MovementFilterDto,
  MovementInputDto,
  MovementOutputDto,
} from '../../../application/dto';
import { MovementMapper } from '../../../application/mappers';
import {
  FindAllMovementsUsecase,
  FindMovementUsecase,
  RemoveMovementUsecase,
  SaveMovementUsecase,
} from '../../../application/usecases';

@Controller('movements')
export class MovementController {
  constructor(
    private readonly findMovementUsecase: FindMovementUsecase,
    private readonly findAllMovementsUsecase: FindAllMovementsUsecase,
    private readonly saveMovementUsecase: SaveMovementUsecase,
    private readonly removeMovementUsecase: RemoveMovementUsecase,
  ) {}

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<MovementOutputDto> {
    const movement = await this.findMovementUsecase.execute(id, user.id);
    return movement && MovementMapper.toOutput(movement);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: MovementFilterDto,
  ): Promise<MovementOutputDto[]> {
    const movements = await this.findAllMovementsUsecase.execute(
      filter,
      user.id,
    );
    return movements.map(MovementMapper.toOutput);
  }

  @Post()
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MovementInputDto,
  ): Promise<MovementOutputDto> {
    const movement = await this.saveMovementUsecase.execute(input, user.id);
    return MovementMapper.toOutput(movement);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<{ status: boolean }> {
    const status = await this.removeMovementUsecase.execute(id, user.id);
    return { status };
  }
}
