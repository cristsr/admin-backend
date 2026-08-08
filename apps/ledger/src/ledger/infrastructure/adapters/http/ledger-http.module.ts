import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';

/**
 * Driving adapter for the ledger's own lifecycle. The controller depends only
 * on the buses, which the global core module provides, so nothing is declared
 * here.
 */
@Module({
  controllers: [LedgerController],
})
export class LedgerHttpModule {}
