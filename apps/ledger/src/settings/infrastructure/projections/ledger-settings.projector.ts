import { Injectable } from '@nestjs/common';
import { Projector } from '../../../shared-kernel/application/projection/projector';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';
import { LedgerInitialized } from '../../../ledger/domain/settings/events/ledger-initialized.event';
import { PresentationCurrencyChanged, TimezoneChanged } from '../../domain/ledger-settings/events';

/**
 * Projects LedgerSettings events to proj_ledger_settings table.
 * - LedgerInitialized: inserts row with initial currency + timezone
 * - PresentationCurrencyChanged: updates presentation_currency column
 * - TimezoneChanged: updates timezone column
 */
@Injectable()
export class LedgerSettingsProjector extends Projector {
  constructor(private readModelStore: ReadModelStore) {
    super();
  }

  async project(event: DomainEvent): Promise<void> {
    if (event instanceof LedgerInitialized) {
      await this.readModelStore.upsert('proj_ledger_settings', event.props.userId as string, {
        user_id: event.props.userId,
        presentation_currency: event.props.presentationCurrency,
        timezone: event.props.timezone,
        updated_at: new Date(),
      });
    } else if (event instanceof PresentationCurrencyChanged) {
      await this.readModelStore.upsert('proj_ledger_settings', event.userId, {
        presentation_currency: event.presentationCurrency,
        updated_at: new Date(),
      });
    } else if (event instanceof TimezoneChanged) {
      await this.readModelStore.upsert('proj_ledger_settings', event.userId, {
        timezone: event.timezone,
        updated_at: new Date(),
      });
    }
  }
}
