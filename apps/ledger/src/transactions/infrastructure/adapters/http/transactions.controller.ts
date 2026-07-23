import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Nullable } from '@shared';
import { CommandBus, CommandResult, QueryBus } from '@ledger/shared/application/ep1-contracts.assumed';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import {
  AmendPendingTransactionCommand,
  AnnotateTransactionCommand,
  CommandPosting,
  ConfirmTransactionCommand,
  RecordTransactionCommand,
  ReverseConfirmedTransactionCommand,
  TransactionByIdQuery,
  TransactionListQuery,
  VoidPendingTransactionCommand,
} from '@ledger/transactions/application/ep1-contracts.assumed';
import { AmendTransactionRequestDto } from './dto/amend-transaction-request.dto';
import { AnnotateTransactionRequestDto } from './dto/annotate-transaction-request.dto';
import { ConfirmTransactionRequestDto } from './dto/confirm-transaction-request.dto';
import { PostingDto } from './dto/posting.dto';
import { RecordTransactionRequestDto } from './dto/record-transaction-request.dto';
import { ReverseTransactionRequestDto } from './dto/reverse-transaction-request.dto';
import { TransactionListDto } from './dto/transaction-list.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionDto } from './dto/transaction.dto';
import { VoidTransactionRequestDto } from './dto/void-transaction-request.dto';

/**
 * Transaction lifecycle and reads (§7.1–§7.4). Each state transition is its own
 * POST action sub-resource mapping to a distinct command with distinct
 * invariants; the controller only maps HTTP to the buses (RNF-10). Writes return
 * a {@link CommandAcceptedDto}; reads return the projection unchanged.
 */
@ApiTags('transactions')
@Controller({ path: 'transactions', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class TransactionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Record a transaction (pending or confirmed).' })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  record(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() dto: RecordTransactionRequestDto,
  ): Promise<CommandResult> {
    const command = new RecordTransactionCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      date: dto.date,
      payee: dto.payee ?? null,
      description: dto.description,
      status: dto.status,
      postings: this.toCommandPostings(dto.postings),
      invoiceUrl: dto.invoiceUrl ?? null,
      tags: dto.tags ?? [],
      metadata: dto.metadata ?? null,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter transactions (RF-13).' })
  @ApiOkResponse({ type: TransactionListDto })
  list(@Context() context: LedgerContext, @Query() query: TransactionQueryDto): Promise<TransactionListDto> {
    return this.queryBus.ask<TransactionListDto>(
      new TransactionListQuery({
        userId: context.userId,
        filters: {
          accountId: query.account ?? null,
          from: query.from ?? null,
          to: query.to ?? null,
          status: query.status ?? null,
          derivedKind: query.derivedKind ?? null,
          payee: query.payee ?? null,
          clientId: query.clientId ?? null,
          limit: query.limit ?? null,
          offset: query.offset ?? null,
        },
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction.' })
  @ApiOkResponse({ type: TransactionDto })
  getOne(@Context() context: LedgerContext, @Param('id') id: string): Promise<TransactionDto> {
    return this.queryBus.ask<TransactionDto>(new TransactionByIdQuery({ userId: context.userId, transactionId: id }));
  }

  @Post(':id/amend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Amend a pending transaction (economic change, INV-6).' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  amend(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: AmendTransactionRequestDto,
  ): Promise<CommandResult> {
    const command = new AmendPendingTransactionCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      transactionId: id,
      postings: dto.postings ? this.toCommandPostings(dto.postings) : null,
      date: dto.date ?? null,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Post(':id/annotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annotate a transaction (non-economic, any non-voided state).' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  annotate(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: AnnotateTransactionRequestDto,
  ): Promise<CommandResult> {
    const command = new AnnotateTransactionCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      transactionId: id,
      payee: dto.payee ?? null,
      description: dto.description ?? null,
      invoiceUrl: dto.invoiceUrl ?? null,
      tags: dto.tags ?? null,
      metadata: dto.metadata ?? null,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a pending transaction.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  confirm(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: ConfirmTransactionRequestDto,
  ): Promise<CommandResult> {
    const command = new ConfirmTransactionCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      transactionId: id,
      postings: dto.postings ? this.toCommandPostings(dto.postings) : null,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a pending transaction.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  void(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: VoidTransactionRequestDto,
  ): Promise<CommandResult> {
    const command = new VoidPendingTransactionCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      transactionId: id,
      reason: dto.reason,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Reverse a confirmed transaction; returns the reversal id (§7.3).' })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  reverse(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: ReverseTransactionRequestDto,
  ): Promise<CommandResult> {
    const command = new ReverseConfirmedTransactionCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      transactionId: id,
      reason: dto.reason ?? null,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  /** Maps request postings to command postings, defaulting absent metadata to null. */
  private toCommandPostings(postings: readonly PostingDto[]): CommandPosting[] {
    return postings.map((posting) => ({
      accountId: posting.accountId,
      amount: posting.amount,
      currency: posting.currency,
      metadata: posting.metadata ?? null,
    }));
  }
}
