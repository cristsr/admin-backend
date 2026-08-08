import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';

/**
 * Account-side driving adapter. Controllers depend only on the command/query
 * buses, which the global core module provides, so this module declares no
 * providers of its own.
 */
@Module({
  controllers: [AccountsController],
})
export class AccountsHttpModule {}
