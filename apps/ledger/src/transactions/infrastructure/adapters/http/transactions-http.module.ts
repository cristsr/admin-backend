import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';

/**
 * Transaction-side driving adapter. The controller depends only on the
 * command/query buses, which the global core module provides, so this module
 * declares no providers of its own.
 */
@Module({
  controllers: [TransactionsController],
})
export class TransactionsHttpModule {}
