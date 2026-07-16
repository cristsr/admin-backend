import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
import { AccountFilterDto, AccountInputDto, AccountOutputDto, UserAccountFilterDto } from '../../../application/dto';
import { AccountMapper } from '../../../application/mappers';
import { FindAccountUsecase, FindAllAccountsUsecase, SaveAccountUsecase } from '../../../application/usecases';

@Controller('accounts')
export class AccountController {
  constructor(
    private readonly findAccountUsecase: FindAccountUsecase,
    private readonly findAllAccountsUsecase: FindAllAccountsUsecase,
    private readonly saveAccountUsecase: SaveAccountUsecase,
  ) {}

  @Get()
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: UserAccountFilterDto,
  ): Promise<AccountOutputDto> {
    const account = await this.findAccountUsecase.execute(filter, user.id);
    return account && AccountMapper.toOutput(account);
  }

  @Get('/query')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: AccountFilterDto,
  ): Promise<AccountOutputDto[]> {
    const accounts = await this.findAllAccountsUsecase.execute(filter, user.id);
    return accounts.map(AccountMapper.toOutput);
  }

  @Post()
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: AccountInputDto,
  ): Promise<AccountOutputDto> {
    const account = await this.saveAccountUsecase.execute(data, user.id);
    return AccountMapper.toOutput(account);
  }
}
