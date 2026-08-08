import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** Body of `POST /transfers/merge`: exactly the two pendings to merge. */
export class MergeTransfersRequestDto {
  @ApiProperty({ type: [String], format: 'uuid', minItems: 2, maxItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsUUID('4', { each: true })
  readonly pendingIds: readonly [string, string];
}
