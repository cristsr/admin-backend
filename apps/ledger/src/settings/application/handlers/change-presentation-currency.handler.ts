import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../shared-kernel/application/command/command-handler';
import { LedgerSettings } from '../../../ledger/domain/settings/ledger-settings.aggregate';
import { LedgerSettingsRepository } from '../../../ledger/domain/settings/repositories/ledger-settings.repository';
import { ChangePresentationCurrencyCommand } from '../commands';
import { CurrencyCode } from '../../domain/ledger-settings/value-objects';

@Injectable()
export class ChangePresentationCurrencyHandler
  implements CommandHandler<ChangePresentationCurrencyCommand>
{
  constructor(private repository: LedgerSettingsRepository) {}

  async execute(command: ChangePresentationCurrencyCommand): Promise<void> {
    const settings = await this.repository.load(command.userId);
    if (!settings) {
      throw new Error(`LedgerSettings not found for user ${command.userId}`);
    }

    const currency = CurrencyCode.of(command.presentationCurrency);
    settings.changePresentationCurrency(currency);

    // Persist only if there are changes
    if (settings.hasUncommittedChanges) {
      await this.repository.save(settings, settings.version);
    }
  }
}
