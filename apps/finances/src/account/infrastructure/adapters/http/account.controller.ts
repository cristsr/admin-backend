import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
import { AccountBalanceOutputDto, AccountInputDto, AccountOutputDto, UserAccountFilterDto } from '../../../application/dto';
import { AccountMapper } from '../../../application/mappers';
import { FindAccountUsecase, FindAllAccountsUsecase, GetAccountBalanceUsecase, RemoveAccountUsecase, SaveAccountUsecase } from '../../../application/usecases';

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
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: UserAccountFilterDto,
  ): Promise<AccountOutputDto> {
    return this.findAccountUsecase.execute(filter, user.id);
  }

  @Get('/query')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccountOutputDto[]> {
    return this.findAllAccountsUsecase.execute(user.id);
  }

  @Get(':id/balance')
  async balance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<AccountBalanceOutputDto> {
    return this.getAccountBalanceUsecase.execute(id, user.id);
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
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ): Promise<{ status: boolean }> {
    const status = await this.removeAccountUsecase.execute(id, user.id);
    return { status };
  }
}
