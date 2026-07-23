import { ApiProperty } from '@nestjs/swagger';

/** Response of `GET /ledger/settings`: the `proj_ledger_settings` projection. */
export class LedgerSettingsDto {
  @ApiProperty({ example: 'COP' })
  readonly presentationCurrency: string;

  @ApiProperty({ example: 'America/Bogota' })
  readonly timezone: string;

  @ApiProperty({ description: 'True once the ledger has been initialized.' })
  readonly isInitialized: boolean;
}
