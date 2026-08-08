import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { QueryContext } from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import { AccountView } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { CloseAccountCommand } from '@ledger/accounts/application/usecases/close-account/close-account.command';
import { GetAccountBalancesQuery } from '@ledger/accounts/application/usecases/get-account-balances/get-account-balances.query';
import { GetAccountByIdQuery } from '@ledger/accounts/application/usecases/get-account-by-id/get-account-by-id.query';
import { GetAccountTreeQuery } from '@ledger/accounts/application/usecases/get-account-tree/get-account-tree.query';
import { OpenAccountCommand } from '@ledger/accounts/application/usecases/open-account/open-account.command';
import { RecordOpeningBalanceCommand } from '@ledger/accounts/application/usecases/record-opening-balance/record-opening-balance.command';
import { RenameAccountCommand } from '@ledger/accounts/application/usecases/rename-account/rename-account.command';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { BalanceView } from '@ledger/transactions/application/read-models/account-balances.read-model';
import { AccountBalanceQueryDto } from './dto/account-balance-query.dto';
import { AccountBalanceDto } from './dto/account-balance.dto';
import { AccountDto } from './dto/account.dto';
import { CloseAccountRequestDto } from './dto/close-account-request.dto';
import { OpenAccountRequestDto } from './dto/open-account-request.dto';
import { RecordOpeningBalanceRequestDto } from './dto/record-opening-balance-request.dto';
import { RenameAccountRequestDto } from './dto/rename-account-request.dto';

/**
 * Account lifecycle and reads. Writes map to a command dispatched with the
 * authenticated {@link AuthContext} carried separately and return a
 * {@link CommandAcceptedDto}; reads ask the query bus and return the projection
 * unchanged. `rename`/`close` are POST action sub-resources, not PATCH/DELETE:
 * they are event-sourced lifecycle transitions.
 */
@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Open an account.' })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  open(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() dto: OpenAccountRequestDto,
  ): Promise<CommandResult> {
    const command = new OpenAccountCommand(dto.name, dto.currencies, dto.openedOn, dto.isBankMirror);

    return this.commandBus.dispatch(command, this.authContext(context, externalRef));
  }

  /**
   * Flat, ordered by name; `parentId` carries the hierarchy. Nesting is left to
   * the client on purpose — the projection stores flat rows, and shaping them
   * server-side would be a second representation of the same tree.
   */
  @Get()
  @ApiOperation({ summary: 'List the chart of accounts.' })
  @ApiOkResponse({ type: [AccountDto] })
  list(@Context() context: LedgerContext): Promise<readonly AccountView[]> {
    return this.queryBus.ask(new GetAccountTreeQuery(), this.queryContext(context));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account.' })
  @ApiOkResponse({ type: AccountDto })
  getOne(
    @Context() context: LedgerContext,
    @Param('id') id: string,
  ): Promise<Nullable<AccountView>> {
    return this.queryBus.ask(new GetAccountByIdQuery(id), this.queryContext(context));
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Account balances (confirmed and pending per currency).' })
  @ApiOkResponse({ type: [AccountBalanceDto] })
  balance(
    @Context() context: LedgerContext,
    @Param('id') id: string,
    @Query() query: AccountBalanceQueryDto,
  ): Promise<readonly BalanceView[]> {
    return this.queryBus.ask(
      new GetAccountBalancesQuery(id, query.currency ?? null),
      this.queryContext(context),
    );
  }

  @Post(':id/rename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename an account.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  rename(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: RenameAccountRequestDto,
  ): Promise<CommandResult> {
    const command = new RenameAccountCommand(id, dto.newName);

    return this.commandBus.dispatch(command, this.authContext(context, externalRef));
  }

  @Post(':id/opening-balance')
  @ApiOperation({
    summary: 'Record the balance a pre-existing account already had.',
    description:
      'Books a confirmed opening entry between the account and the user\'s ' +
      '`Equity:OpeningBalances`. The counterparty and the system origin are ' +
      'resolved server-side and cannot be influenced by the request (INV-13).',
  })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  openingBalance(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: RecordOpeningBalanceRequestDto,
  ): Promise<CommandResult> {
    const command = new RecordOpeningBalanceCommand(id, dto.amount, dto.currency, dto.date);

    return this.commandBus.dispatch(command, this.authContext(context, externalRef));
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close an account.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  close(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: CloseAccountRequestDto,
  ): Promise<CommandResult> {
    const command = new CloseAccountCommand(id, dto.closedOn);

    return this.commandBus.dispatch(command, this.authContext(context, externalRef));
  }

  /** Builds the write-side context: identity plus the optional idempotency key. */
  private authContext(context: LedgerContext, externalRef: Nullable<string>): AuthContext {
    return { userId: context.userId, clientId: context.clientId, externalRef };
  }

  /** Builds the read-side context: the owning user that partitions every read (INV-9). */
  private queryContext(context: LedgerContext): QueryContext {
    return { userId: context.userId };
  }
}
