import { Module } from '@nestjs/common';
import { LedgerSettingsProjector } from './infrastructure/projections/ledger-settings.projector';

/**
 * EP-4.1: LedgerSettings management.
 * The command/query handlers and HTTP controller are pending migration to the
 * current shared-kernel API (CommandHandler → command-bus, QueryHandler →
 * query-bus, AuthGuard → LedgerContextGuard + @Context, CommandBus.dispatch
 * → dispatch(command, AuthContext)). Only the projector is active.
 */
@Module({
  providers: [LedgerSettingsProjector],
})
export class SettingsModule {}
