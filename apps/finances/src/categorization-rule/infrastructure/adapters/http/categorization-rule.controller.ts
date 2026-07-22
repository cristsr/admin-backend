import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@shared';
import {
  CategorizationRuleInputDto,
  CategorizationRuleOutputDto,
  CategorizationRuleUpdateInputDto,
} from '@app/categorization-rule/application/dto';
import { CategorizationRuleMapper } from '@app/categorization-rule/application/mappers';
import {
  CreateCategorizationRuleUsecase,
  FindAllCategorizationRulesUsecase,
  RemoveCategorizationRuleUsecase,
  UpdateCategorizationRuleUsecase,
} from '@app/categorization-rule/application/usecases';

@ApiTags('categorization-rules')
@ApiBearerAuth()
@Controller('categorization-rules')
export class CategorizationRuleController {
  constructor(
    private readonly createUsecase: CreateCategorizationRuleUsecase,
    private readonly findAllUsecase: FindAllCategorizationRulesUsecase,
    private readonly updateUsecase: UpdateCategorizationRuleUsecase,
    private readonly removeUsecase: RemoveCategorizationRuleUsecase,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CategorizationRuleInputDto,
  ): Promise<CategorizationRuleOutputDto> {
    const rule = await this.createUsecase.execute(input, user.id);
    return CategorizationRuleMapper.toOutput(rule);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<CategorizationRuleOutputDto[]> {
    const rules = await this.findAllUsecase.execute(user.id);
    return rules.map(CategorizationRuleMapper.toOutput);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
    @Body() input: CategorizationRuleUpdateInputDto,
  ): Promise<CategorizationRuleOutputDto> {
    const rule = await this.updateUsecase.execute(id, input, user.id);
    return CategorizationRuleMapper.toOutput(rule);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: number): Promise<void> {
    await this.removeUsecase.execute(id, user.id);
  }
}
