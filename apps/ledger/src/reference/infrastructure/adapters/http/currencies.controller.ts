import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Nullable } from '@shared';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';
import {
  CurrencyView,
  ListCurrenciesQuery,
} from '@ledger/reference/application/list-currencies.query';
import { RegisterCurrencyCommand } from '@ledger/reference/application/register-currency.command';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { QueryBus } from '@ledger/shared-kernel/application/query-bus/query-bus';

/** Body of a currency registration. */
export class RegisterCurrencyRequestDto {
  @ApiProperty({ example: 'CLF', description: 'ISO-4217 code.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, { message: 'code must be a 3-letter ISO-4217 code' })
  readonly code: string;

  @ApiProperty({ example: 4, minimum: 0, maximum: 4, description: 'Decimal places (ISO-4217).' })
  @IsInt()
  @Min(0)
  @Max(4)
  readonly minorUnits: number;

  @ApiProperty({ example: 'Unidad de Fomento' })
  @IsString()
  @IsNotEmpty()
  readonly name: string;
}

/**
 * Reference currency catalog. Global by design: a currency's precision is
 * universal, so these endpoints are not scoped by user even though they still
 * require an authenticated context (RF-26).
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
  @ApiOkResponse({ type: CommandAcceptedDto, isArray: false })
  list(@Context() context: LedgerContext): Promise<CurrencyView[]> {
    return this.queryBus.ask<CurrencyView[]>(new ListCurrenciesQuery(), {
      userId: context.userId,
    });
  }
}
