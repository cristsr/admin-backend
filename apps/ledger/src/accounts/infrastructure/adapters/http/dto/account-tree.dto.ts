import { ApiProperty } from '@nestjs/swagger';
import { AccountTreeView } from './account-tree-view';
import { AccountDto } from './account.dto';

/** Response of `GET /accounts`: the user's chart of accounts in the requested view. */
export class AccountTreeDto {
  @ApiProperty({ enum: AccountTreeView })
  readonly view: AccountTreeView;

  @ApiProperty({ type: [AccountDto] })
  readonly accounts: AccountDto[];
}
