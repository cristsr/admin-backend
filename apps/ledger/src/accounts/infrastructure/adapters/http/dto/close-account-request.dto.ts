import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/** Body of `POST /accounts/{id}/close`. */
export class CloseAccountRequestDto {
  @ApiProperty({ example: '2026-07-20', description: 'Plain accounting date the account closes on.' })
  @IsDateString()
  readonly closedOn: string;
}
