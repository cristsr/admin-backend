import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

/** Body of `POST /transfers/merge`: exactly the two pendings to merge. */
export class MergeTransfersRequestDto {
  @ApiProperty({ type: [String], format: 'uuid', minItems: 2, maxItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsUUID('4', { each: true })
  readonly pendingIds: readonly [string, string];
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
