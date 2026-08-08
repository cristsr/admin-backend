import { ApiProperty } from '@nestjs/swagger';
import { CurrencyView } from '@ledger/reference/application/usecases/list-currencies/list-currencies.query';

/**
 * One currency of the reference catalog.
 *
 * Documents {@link CurrencyView}; `implements` keeps the contract and the query
 * handler from drifting apart.
 */
export class CurrencyDto implements CurrencyView {
  @ApiProperty({ example: 'COP', description: 'ISO-4217 code.' })
  readonly code: string;

  @ApiProperty({ example: 2, description: 'Decimal places the currency admits (INV-8).' })
  readonly minorUnits: number;

  @ApiProperty({ example: 'Peso colombiano' })
  readonly name: string;
}
