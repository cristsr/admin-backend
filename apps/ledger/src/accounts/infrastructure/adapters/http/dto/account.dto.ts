import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@ledger/shared/domain/value-objects';

/**
 * A single account node as served by the `account_tree` projection. A read
 * shape for the OpenAPI contract; the query side is its source of truth.
 */
export class AccountDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ enum: AccountType })
  readonly type: AccountType;

  @ApiProperty({ example: 'Assets:Bancolombia:Savings' })
  readonly name: string;

  @ApiPropertyOptional({ format: 'uuid' })
  readonly parentId?: string;

  @ApiProperty({ type: [String], example: ['COP'] })
  readonly currencies: string[];

  @ApiProperty({ description: 'True once the account has been closed.' })
  readonly isClosed: boolean;

  @ApiProperty({ description: 'True for technical system accounts that cannot be closed (INV-13).' })
  readonly isSystem: boolean;
}
