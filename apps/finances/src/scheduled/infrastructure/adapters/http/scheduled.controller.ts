import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
import {
  ScheduledFilterDto,
  ScheduledInputDto,
  ScheduledOutputDto,
  ScheduledPatchDto,
} from '../../../application/dto';
import { ScheduledMapper } from '../../../application/mappers';
import {
  FindAllScheduledUsecase,
  FindScheduledUsecase,
  RemoveScheduledUsecase,
  SaveScheduledUsecase,
  UpdateScheduledUsecase,
} from '../../../application/usecases';

@Controller('scheduled')
export class ScheduledController {
  constructor(
    private readonly findScheduledUsecase: FindScheduledUsecase,
    private readonly findAllScheduledUsecase: FindAllScheduledUsecase,
    private readonly saveScheduledUsecase: SaveScheduledUsecase,
    private readonly updateScheduledUsecase: UpdateScheduledUsecase,
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

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
    @Body() patch: ScheduledPatchDto,
  ): Promise<ScheduledOutputDto> {
    const scheduled = await this.updateScheduledUsecase.execute(
      id,
      patch,
      user.id,
    );
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
