import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { LedgerController } from './ledger.controller';

/**
 * Account-side driving adapter. Controllers depend only on the command/query
 * buses (provided globally by EP-1's bus module), so this module declares no
 * providers of its own.
 */
@Module({
  controllers: [LedgerController, AccountsController],
})
export class AccountsHttpModule {}
