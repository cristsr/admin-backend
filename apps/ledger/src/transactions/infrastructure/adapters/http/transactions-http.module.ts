import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';

/**
 * Transaction-side driving adapter. The controller depends only on the
 * command/query buses (provided globally by EP-1's bus module), so this module
 * declares no providers of its own.
 */
@Module({
  controllers: [TransactionsController],
})
export class TransactionsHttpModule {}
