import { ApiProperty } from '@nestjs/swagger';
import { LedgerSettingsView } from '@ledger/ledger/application/read-models/ledger-settings.read-model';

/**
 * Response of `GET /ledger/settings`.
 *
 * Documents {@link LedgerSettingsView}; `implements` keeps the contract and the
 * query handler from drifting apart.
 */
export class LedgerSettingsDto implements LedgerSettingsView {
  @ApiProperty({ example: 'COP' })
  readonly presentationCurrency: string;

  @ApiProperty({ example: 'America/Bogota' })
  readonly timezone: string;

  @ApiProperty({ description: 'True once the ledger has been initialized.' })
  readonly isInitialized: boolean;
}
