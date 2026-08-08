import { ApiProperty } from '@nestjs/swagger';
import { Nullable } from '@shared';
import { AccountView } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { AccountType } from '@ledger/shared/domain/value-objects';

/**
 * A single account node as served by the `account_tree` projection.
 *
 * Documents {@link AccountView}, which is what the query handler actually
 * returns — the `implements` is what keeps the two from drifting: a field added
 * to the view without a matching `@ApiProperty` here stops compiling.
 */
export class AccountDto implements AccountView {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ enum: AccountType })
  readonly type: AccountType;

  @ApiProperty({ example: 'Assets:Bancolombia:Savings' })
  readonly name: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  readonly parentId: Nullable<string>;

  @ApiProperty({
    example: 'COP',
    nullable: true,
    description: 'The single currency a real account accepts; null when it accepts any (INV-4).',
  })
  readonly currency: Nullable<string>;

  @ApiProperty({ format: 'date', example: '2026-01-01' })
  readonly openedOn: string;

  @ApiProperty({ format: 'date', nullable: true })
  readonly closedOn: Nullable<string>;

  @ApiProperty({ description: 'True when the account mirrors a bank feed.' })
  readonly isBankMirror: boolean;

  @ApiProperty({ description: 'True once the account has been closed.' })
  readonly isClosed: boolean;

  @ApiProperty({ description: 'True for technical system accounts that cannot be closed (INV-13).' })
  readonly isSystem: boolean;
}
