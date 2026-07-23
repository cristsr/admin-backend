import { Injectable } from '@nestjs/common';
import { QueryHandler } from '../../../shared-kernel/application/query/query-handler';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { GetLedgerSettingsQuery } from '../queries';
import { LedgerSettingsOutputDto } from '../dto';

@Injectable()
export class GetLedgerSettingsHandler
  implements QueryHandler<GetLedgerSettingsQuery, LedgerSettingsOutputDto>
{
  constructor(private readModelStore: ReadModelStore) {}

  async execute(query: GetLedgerSettingsQuery): Promise<LedgerSettingsOutputDto> {
    const rows = await this.readModelStore.query('proj_ledger_settings', {
      user_id: query.userId,
    });

    if (rows.length === 0) {
      throw new Error(`LedgerSettings not found for user ${query.userId}`);
    }

    const row = rows[0];
    return new LedgerSettingsOutputDto(
      row.user_id,
      row.presentation_currency,
      row.timezone,
      new Date(row.updated_at),
    );
  }
}
