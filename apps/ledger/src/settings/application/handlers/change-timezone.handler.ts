import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../shared-kernel/application/command/command-handler';
import { LedgerSettings } from '../../../ledger/domain/settings/ledger-settings.aggregate';
import { LedgerSettingsRepository } from '../../../ledger/domain/settings/repositories/ledger-settings.repository';
import { ChangeTimezoneCommand } from '../commands';
import { IanaTimeZone } from '../../domain/ledger-settings/value-objects';

@Injectable()
export class ChangeTimezoneHandler implements CommandHandler<ChangeTimezoneCommand> {
  constructor(private repository: LedgerSettingsRepository) {}

  async execute(command: ChangeTimezoneCommand): Promise<void> {
    const settings = await this.repository.load(command.userId);
    if (!settings) {
      throw new Error(`LedgerSettings not found for user ${command.userId}`);
    }

    const timezone = IanaTimeZone.of(command.timezone);
    settings.changeTimezone(timezone);

    if (settings.hasUncommittedChanges) {
      await this.repository.save(settings, settings.version);
    }
  }
}
