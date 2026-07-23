import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/** Body of `POST /accounts/{id}/close`. */
export class CloseAccountRequestDto {
  @ApiProperty({ example: '2026-07-20', description: 'Plain accounting date the account closes on (RNF-7).' })
  @IsDateString()
  readonly closedOn: string;
}
