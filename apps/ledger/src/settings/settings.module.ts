import { Module } from '@nestjs/common';
import { LedgerSettingsProjector } from './infrastructure/projections/ledger-settings.projector';
import { ChangePresentationCurrencyHandler, ChangeTimezoneHandler, GetLedgerSettingsHandler } from './application/handlers';
import { LedgerSettingsController } from './infrastructure/adapters/http/ledger-settings.controller';

/**
 * EP-4.1: LedgerSettings management.
 * Depends on the global command/query buses wired by LedgerCoreModule.
 */
@Module({
  controllers: [LedgerSettingsController],
  providers: [
    LedgerSettingsProjector,
    ChangePresentationCurrencyHandler,
    ChangeTimezoneHandler,
    GetLedgerSettingsHandler,
  ],
})
export class SettingsModule {}
