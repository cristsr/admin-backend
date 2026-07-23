import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Nullable } from '@shared';
import { AssertBalanceCommand } from '@ledger/reconciliation/application/commands/assert-balance.command';
import { AssertBalanceHandler } from '@ledger/reconciliation/application/commands/assert-balance.handler';
import { ResolveDiscrepancyCommand } from '@ledger/reconciliation/application/commands/resolve-discrepancy.command';
import { ResolveDiscrepancyHandler } from '@ledger/reconciliation/application/commands/resolve-discrepancy.handler';
import { RevokeAssertionCommand } from '@ledger/reconciliation/application/commands/revoke-assertion.command';
import { RevokeAssertionHandler } from '@ledger/reconciliation/application/commands/revoke-assertion.handler';
import { AssertBalanceInputDto } from '@ledger/reconciliation/application/dto/assert-balance-input.dto';
import { RevokeAssertionInputDto } from '@ledger/reconciliation/application/dto/revoke-assertion-input.dto';
import {
  GetAssertionStatusHandler,
  GetAssertionStatusQuery,
} from '@ledger/reconciliation/application/queries/get-assertion-status.query';
import {
  ListAssertionsHandler,
  ListAssertionsQuery,
} from '@ledger/reconciliation/application/queries/list-assertions.query';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { Context, ExternalRef } from '@ledger/shared/infrastructure/adapters/http';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';

/**
 * HTTP surface for reconciliation (§7.5): translates REST calls into the
 * reconciliation application handlers, passing the authenticated
 * {@link AuthContext} separately (RNF-10). No domain logic here — the controller
 * only adapts.
 */
@Controller({ path: 'balance-assertions', version: '1' })
export class BalanceAssertionController {
  constructor(
    private readonly assertBalance: AssertBalanceHandler,
    private readonly revokeAssertion: RevokeAssertionHandler,
    private readonly resolveDiscrepancy: ResolveDiscrepancyHandler,
    private readonly getStatus: GetAssertionStatusHandler,
    private readonly listAssertions: ListAssertionsHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  assert(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() body: AssertBalanceInputDto,
  ) {
    return this.assertBalance.execute(
      new AssertBalanceCommand(
        body.accountId,
        body.date,
        body.occurredAt,
        body.expectedAmount,
        body.currency,
        body.tolerance ?? '0',
      ),
      this.authContext(context, externalRef),
    );
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() body: RevokeAssertionInputDto,
  ) {
    return this.revokeAssertion.execute(
      new RevokeAssertionCommand(id, body.reason),
      this.authContext(context, externalRef),
    );
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
  ) {
    return this.resolveDiscrepancy.execute(
      new ResolveDiscrepancyCommand(id),
      this.authContext(context, externalRef),
    );
  }

  @Get(':id')
  byId(@Context() context: LedgerContext, @Param('id') id: string) {
    return this.getStatus.execute(new GetAssertionStatusQuery(context.userId, id));
  }

  @Get()
  list(@Context() context: LedgerContext, @Query('accountId') accountId: string) {
    return this.listAssertions.execute(new ListAssertionsQuery(context.userId, accountId));
  }

  private authContext(context: LedgerContext, externalRef: Nullable<string>): AuthContext {
    return { userId: context.userId, clientId: context.clientId, externalRef };
  }
}
