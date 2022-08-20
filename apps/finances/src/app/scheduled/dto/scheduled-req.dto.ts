import { IsDateString, IsIn, IsNumber, IsString } from 'class-validator';

export class CreateScheduled {
  @IsIn([''])
  type: any;

  @IsDateString()
  date: string;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsString()
  recurrent: string;

  @IsNumber()
  category: number;

  @IsNumber()
  subcategory: number;
}
