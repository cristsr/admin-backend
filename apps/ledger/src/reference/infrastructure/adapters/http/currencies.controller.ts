import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { Nullable } from '@shared';
import {
  CurrencyView,
  ListCurrenciesQuery,
} from '@ledger/reference/application/usecases/list-currencies/list-currencies.query';
import { RegisterCurrencyCommand } from '@ledger/reference/application/usecases/register-currency/register-currency.command';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { CurrencyDto, RegisterCurrencyRequestDto } from './dto';

/**
 * Reference currency catalog. Global by design: a currency's precision is
 * universal, so these endpoints are not scoped by user even though they still
 * require an authenticated context.
 */
@ApiTags('currencies')
@Controller({ path: 'currencies', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class CurrenciesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a currency in the reference catalog.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  register(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() dto: RegisterCurrencyRequestDto,
  ): Promise<CommandResult> {
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
    };

    return this.commandBus.dispatch(
      new RegisterCurrencyCommand(dto.code, dto.minorUnits, dto.name),
      ctx,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List the registered currencies.' })
  @ApiOkResponse({ type: [CurrencyDto] })
  list(@Context() context: LedgerContext): Promise<CurrencyView[]> {
    return this.queryBus.ask(new ListCurrenciesQuery(), {
      userId: context.userId,
    });
  }
}
