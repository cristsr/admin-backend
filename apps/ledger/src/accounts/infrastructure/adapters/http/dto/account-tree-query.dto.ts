import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AccountTreeView } from '@ledger/accounts/application/ep1-contracts.assumed';

/** Query string of `GET /accounts`: how to shape the `account_tree` projection. */
export class AccountTreeQueryDto {
  @ApiPropertyOptional({ enum: AccountTreeView, default: AccountTreeView.TREE })
  @IsOptional()
  @IsEnum(AccountTreeView)
  readonly view?: AccountTreeView;
}
