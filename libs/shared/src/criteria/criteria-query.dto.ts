import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_PAGE_SIZE } from '../functions/pagination';
import { FilterOperator } from './filter-operator';
import { OrderType } from './order-type';

export class CriteriaFilterQueryDto {
  @ApiProperty({ description: 'Field to filter on.' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ enum: FilterOperator })
  @IsEnum(FilterOperator)
  operator: FilterOperator;

  @ApiPropertyOptional({
    description:
      'Value to compare against. List operators (in, between) accept either a ' +
      'comma-separated string or repeated entries.',
  })
  @IsOptional()
  value?: string | string[];
}

export class CriteriaQueryDto {
  @ApiPropertyOptional({ type: [CriteriaFilterQueryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriteriaFilterQueryDto)
  filters?: CriteriaFilterQueryDto[];

  @ApiPropertyOptional({ description: 'Field to sort by.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderBy?: string;

  @ApiPropertyOptional({ enum: OrderType, default: OrderType.ASC })
  @IsOptional()
  @IsEnum(OrderType)
  order?: OrderType;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
