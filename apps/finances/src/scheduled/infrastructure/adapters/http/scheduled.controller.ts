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
  ScheduledFilterDto,
  ScheduledInputDto,
  ScheduledOutputDto,
} from '../../../application/dto';
import { ScheduledMapper } from '../../../application/mappers';
import {
  FindAllScheduledUsecase,
  FindScheduledUsecase,
  RemoveScheduledUsecase,
  SaveScheduledUsecase,
} from '../../../application/usecases';

@Controller('scheduled')
export class ScheduledController {
  constructor(
    private readonly findScheduledUsecase: FindScheduledUsecase,
    private readonly findAllScheduledUsecase: FindAllScheduledUsecase,
    private readonly saveScheduledUsecase: SaveScheduledUsecase,
    private readonly removeScheduledUsecase: RemoveScheduledUsecase,
  ) {}

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<ScheduledOutputDto> {
    const scheduled = await this.findScheduledUsecase.execute(id, user.id);
    return scheduled && ScheduledMapper.toOutput(scheduled);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ScheduledFilterDto,
  ): Promise<ScheduledOutputDto[]> {
    const scheduled = await this.findAllScheduledUsecase.execute(
      filter,
      user.id,
    );
    return scheduled.map(ScheduledMapper.toOutput);
  }

  @Post()
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ScheduledInputDto,
  ): Promise<ScheduledOutputDto> {
    const scheduled = await this.saveScheduledUsecase.execute(input, user.id);
    return ScheduledMapper.toOutput(scheduled);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<{ status: boolean }> {
    const status = await this.removeScheduledUsecase.execute(id, user.id);
    return { status };
  }
}
