import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CriteriaQueryDto, CurrentUser } from '@shared';
import { IdempotencyInterceptor } from '@app/idempotency/infrastructure/adapters/http';
import {
  MovementInputDto,
  MovementOutputDto,
  MovementPatchDto,
} from '@app/movement/application/dto';
import { MovementMapper } from '@app/movement/application/mappers';
import {
  FindAllMovementsUsecase,
  FindMovementUsecase,
  RemoveMovementUsecase,
  SaveMovementUsecase,
  UpdateMovementUsecase,
} from '@app/movement/application/usecases';

@ApiTags('movements')
@ApiBearerAuth()
@Controller('movements')
export class MovementController {
  constructor(
    private readonly findMovementUsecase: FindMovementUsecase,
    private readonly findAllMovementsUsecase: FindAllMovementsUsecase,
    private readonly saveMovementUsecase: SaveMovementUsecase,
    private readonly updateMovementUsecase: UpdateMovementUsecase,
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

  /**
   * Filters follow the shared criteria contract, e.g.
   * `?filters[0][field]=amount&filters[0][operator]=gte&filters[0][value]=1000`
   * `&orderBy=date&order=desc&limit=20`.
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CriteriaQueryDto,
  ): Promise<MovementOutputDto[]> {
    const movements = await this.findAllMovementsUsecase.execute(query, user.id);
    return movements.map(MovementMapper.toOutput);
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MovementInputDto,
  ): Promise<MovementOutputDto> {
    const movement = await this.saveMovementUsecase.execute(input, user.id);
    return MovementMapper.toOutput(movement);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
    @Body() patch: MovementPatchDto,
  ): Promise<MovementOutputDto> {
    const movement = await this.updateMovementUsecase.execute(id, patch, user.id);
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
