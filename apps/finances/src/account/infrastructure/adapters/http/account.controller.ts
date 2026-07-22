import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CriteriaQueryDto, CurrentUser } from '@shared';
import {
  AccountArchivedOutputDto,
  AccountBalanceOutputDto,
  AccountInputDto,
  AccountOutputDto,
} from '@app/account/application/dto';
import { AccountMapper } from '@app/account/application/mappers';
import {
  FindAccountUsecase,
  FindAllAccountsUsecase,
  GetAccountBalanceUsecase,
  RemoveAccountUsecase,
  SaveAccountUsecase,
} from '@app/account/application/usecases';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountController {
  constructor(
    private readonly findAccountUsecase: FindAccountUsecase,
    private readonly findAllAccountsUsecase: FindAllAccountsUsecase,
    private readonly getAccountBalanceUsecase: GetAccountBalanceUsecase,
    private readonly saveAccountUsecase: SaveAccountUsecase,
    private readonly removeAccountUsecase: RemoveAccountUsecase,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CriteriaQueryDto,
  ): Promise<AccountOutputDto[]> {
    return this.findAllAccountsUsecase.execute(query, user.id);
  }

  // Registered before `:id` so the literal segment is not swallowed by it.
  @Get(':id/balance')
  async balance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<AccountBalanceOutputDto> {
    return this.getAccountBalanceUsecase.execute(id, user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: number): Promise<AccountOutputDto> {
    return this.findAccountUsecase.execute(id, user.id);
  }

  @Post()
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: AccountInputDto,
  ): Promise<AccountOutputDto> {
    const account = await this.saveAccountUsecase.execute(data, user.id);
    return AccountMapper.toOutput(account);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<AccountArchivedOutputDto> {
    return this.removeAccountUsecase.execute(id, user.id);
  }
}
