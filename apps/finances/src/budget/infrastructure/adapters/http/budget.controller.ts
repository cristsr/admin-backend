import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@shared';
import {
  BudgetFilterDto,
  BudgetInputDto,
  BudgetOutputDto,
} from '@app/budget/application/dto';
import { BudgetMapper } from '@app/budget/application/mappers';
import {
  FindAllBudgetsUsecase,
  FindBudgetMovementsUsecase,
  FindBudgetUsecase,
  RemoveBudgetUsecase,
  SaveBudgetUsecase,
} from '@app/budget/application/usecases';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetController {
  constructor(
    private readonly findBudgetUsecase: FindBudgetUsecase,
    private readonly findAllBudgetsUsecase: FindAllBudgetsUsecase,
    private readonly findBudgetMovementsUsecase: FindBudgetMovementsUsecase,
    private readonly saveBudgetUsecase: SaveBudgetUsecase,
    private readonly removeBudgetUsecase: RemoveBudgetUsecase,
  ) {}

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<BudgetOutputDto> {
    const budget = await this.findBudgetUsecase.execute({ budget: id }, user.id);
    return budget && BudgetMapper.toOutput(budget);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BudgetFilterDto,
  ): Promise<BudgetOutputDto[]> {
    const budgets = await this.findAllBudgetsUsecase.execute(filter, user.id);
    return budgets.map(BudgetMapper.toOutput);
  }

  @Get(':id/movements')
  async findMovements(@CurrentUser() user: AuthenticatedUser, @Param('id') id: number) {
    return this.findBudgetMovementsUsecase.execute(id, user.id);
  }

  @Post()
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: BudgetInputDto,
  ): Promise<BudgetOutputDto> {
    const budget = await this.saveBudgetUsecase.execute(data, user.id);
    return BudgetMapper.toOutput(budget);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<{ status: boolean }> {
    const status = await this.removeBudgetUsecase.execute(id, user.id);
    return { status };
  }
}
