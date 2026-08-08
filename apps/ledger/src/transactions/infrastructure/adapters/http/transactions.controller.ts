import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { Command } from '@cqrs/application/command-bus/command';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { QueryContext } from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { AmendPendingTransactionCommand } from '@ledger/transactions/application/amend-transaction/amend-pending-transaction.command';
import { AnnotateTransactionCommand } from '@ledger/transactions/application/annotate-transaction/annotate-transaction.command';
import { ConfirmTransactionCommand } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.command';
import { GetTransactionByIdQuery } from '@ledger/transactions/application/get-transaction-by-id/get-transaction-by-id.query';
import { ListPendingReviewQuery } from '@ledger/transactions/application/list-pending-review/list-pending-review.query';
import {
  ListTransactionsQuery,
  TransactionPage,
} from '@ledger/transactions/application/list-transactions/list-transactions.query';
import { PostingInput } from '@ledger/transactions/application/posting-input.type';
import { PendingReviewView } from '@ledger/transactions/application/read-models/pending-review.read-model';
import { TransactionView } from '@ledger/transactions/application/read-models/transaction-list.read-model';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { ReverseConfirmedTransactionCommand } from '@ledger/transactions/application/reverse-transaction/reverse-confirmed-transaction.command';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/void-transaction/void-pending-transaction.command';
import { AmendTransactionRequestDto } from './dto/amend-transaction-request.dto';
import { AnnotateTransactionRequestDto } from './dto/annotate-transaction-request.dto';
import { ConfirmTransactionRequestDto } from './dto/confirm-transaction-request.dto';
import { PendingReviewQueryDto } from './dto/pending-review-query.dto';
import { PendingReviewDto } from './dto/pending-review.dto';
import { PostingDto } from './dto/posting.dto';
import { RecordTransactionRequestDto } from './dto/record-transaction-request.dto';
import { ReverseTransactionRequestDto } from './dto/reverse-transaction-request.dto';
import { TransactionListDto } from './dto/transaction-list.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionDto } from './dto/transaction.dto';
import { VoidTransactionRequestDto } from './dto/void-transaction-request.dto';

/**
 * Transaction lifecycle and reads. Each state transition is its own
 * POST action sub-resource mapping to a distinct command with distinct
 * invariants; the controller maps HTTP to the buses and passes the authenticated
 * {@link AuthContext} separately. Writes return a {@link CommandAcceptedDto};
 * reads return the projection unchanged.
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
    const command = new RecordTransactionCommand(
      dto.date,
      dto.payee ?? null,
      dto.description,
      this.toPostings(dto.postings),
      dto.status,
      dto.invoiceUrl ?? null,
      dto.tags ?? [],
      this.toStringMetadata(dto.metadata),
      dto.occurredAt ?? null,
      // `origin` is deliberately left at its CLIENT default: nothing arriving
      // over HTTP may post against a technical account (INV-13).
    );

    return this.dispatch(command, context, externalRef);
  }

  /** A page of the list, newest first, with the total the filters match. */
  @Get()
  @ApiOperation({ summary: 'List and filter transactions.' })
  @ApiOkResponse({ type: TransactionListDto })
  list(
    @Context() context: LedgerContext,
    @Query() query: TransactionQueryDto,
  ): Promise<TransactionPage> {
    return this.queryBus.ask(
      new ListTransactionsQuery(
        query.account ?? null,
        query.status ?? null,
        query.derivedKind ?? null,
        query.payee ?? null,
        query.clientId ?? null,
        query.from ?? null,
        query.to ?? null,
        query.limit ?? null,
        query.offset ?? null,
      ),
      this.queryContext(context),
    );
  }

  /**
   * Declared before `:id` on purpose: Nest matches in declaration order, so the
   * parameterized route would otherwise swallow this path.
   */
  @Get('pending-review')
  @ApiOperation({ summary: "The review inbox: transactions awaiting the user's decision." })
  @ApiOkResponse({ type: [PendingReviewDto] })
  pendingReview(
    @Context() context: LedgerContext,
    @Query() query: PendingReviewQueryDto,
  ): Promise<readonly PendingReviewView[]> {
    return this.queryBus.ask(
      new ListPendingReviewQuery(query.limit ?? null, query.offset ?? null),
      this.queryContext(context),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction, with its postings.' })
  @ApiOkResponse({ type: TransactionDto })
  getOne(
    @Context() context: LedgerContext,
    @Param('id') id: string,
  ): Promise<Nullable<TransactionView>> {
    return this.queryBus.ask(new GetTransactionByIdQuery(id), this.queryContext(context));
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
    const command = new AmendPendingTransactionCommand(id, dto.date, this.toPostings(dto.postings));

    return this.dispatch(command, context, externalRef);
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
    const command = new AnnotateTransactionCommand(
      id,
      dto.payee ?? null,
      dto.description ?? '',
      dto.invoiceUrl ?? null,
      dto.tags ?? [],
      this.toStringMetadata(dto.metadata),
    );

    return this.dispatch(command, context, externalRef);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a pending transaction.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  confirm(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() _dto: ConfirmTransactionRequestDto,
  ): Promise<CommandResult> {
    return this.dispatch(new ConfirmTransactionCommand(id), context, externalRef);
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
    return this.dispatch(new VoidPendingTransactionCommand(id, dto.reason), context, externalRef);
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Reverse a confirmed transaction; returns the reversal id.' })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  reverse(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() _dto: ReverseTransactionRequestDto,
  ): Promise<CommandResult> {
    return this.dispatch(new ReverseConfirmedTransactionCommand(id), context, externalRef);
  }

  /** Dispatches a command with the write-side context assembled from the request. */
  private dispatch(
    command: Command,
    context: LedgerContext,
    externalRef: Nullable<string>,
  ): Promise<CommandResult> {
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
    };

    return this.commandBus.dispatch(command, ctx);
  }

  /** Builds the read-side context: the owning user that partitions every read (INV-9). */
  private queryContext(context: LedgerContext): QueryContext {
    return { userId: context.userId };
  }

  /** Maps request postings to the API-shaped {@link PostingInput}. */
  private toPostings(postings: readonly PostingDto[]): PostingInput[] {
    return postings.map((posting) => ({
      accountId: posting.accountId,
      amount: posting.amount,
      currency: posting.currency,
      ...(posting.metadata ? { metadata: this.toStringMetadata(posting.metadata) } : {}),
    }));
  }

  /** Coerces free-form request metadata to the string-valued map the domain stores. */
  private toStringMetadata(metadata: Nullable<Record<string, unknown>> | undefined): Record<string, string> {
    if (!metadata) return {};

    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, String(value)]),
    );
  }
}
