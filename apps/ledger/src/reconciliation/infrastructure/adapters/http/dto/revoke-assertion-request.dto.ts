import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Body of `POST /balance-assertions/{id}/revoke`. */
export class RevokeAssertionRequestDto {
  @ApiProperty({ example: 'Statement was corrected by the bank' })
  @IsString()
  readonly reason: string;
}
