import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CommandBus } from '../../../shared-kernel/application/command/command-bus';
import { QueryBus } from '../../../shared-kernel/application/query/query-bus';
import { CurrentUser } from '../../../shared/application/decorators/current-user.decorator';
import { LedgerContext } from '../../../shared/domain/ledger-context';
import { AuthGuard } from '../../../shared/infrastructure/guards/auth.guard';
import { RegisterCurrencyCommand } from '../../application/commands/register-currency.command';
import { ListCurrenciesQuery } from '../../application/queries/list-currencies.query';
import { CurrencyOutputDto } from '../../application/dto/currency-output.dto';

@Controller('reference/currencies')
@UseGuards(AuthGuard)
export class CurrenciesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async list(@CurrentUser() context: LedgerContext): Promise<CurrencyOutputDto[]> {
    return this.queryBus.ask(new ListCurrenciesQuery(context.userId));
  }

  @Post()
  async register(
    @CurrentUser() context: LedgerContext,
    @Body() dto: { code: string; minorUnits: number; name: string },
  ): Promise<void> {
    await this.commandBus.dispatch(
      new RegisterCurrencyCommand(context.userId, dto.code, dto.minorUnits, dto.name),
    );
  }
}
