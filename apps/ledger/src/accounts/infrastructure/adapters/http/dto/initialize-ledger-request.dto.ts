import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body of `POST /ledger/initialize`. Domain rules are enforced by the handler. */
export class InitializeLedgerRequestDto {
  @ApiProperty({ example: 'COP', description: 'ISO currency the ledger reports in.' })
  @IsString()
  @IsNotEmpty()
  readonly presentationCurrency: string;

  @ApiProperty({ example: 'America/Bogota', description: 'IANA timezone for accounting dates.' })
  @IsString()
  @IsNotEmpty()
  readonly timezone: string;
}
