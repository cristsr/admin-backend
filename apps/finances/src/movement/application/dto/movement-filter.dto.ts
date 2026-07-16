import { MovementType } from '../../domain/movement';

export class MovementFilterDto {
  startDate: Date;

  endDate: Date;

  account?: number;

  category?: number;

  order?: string;

  type?: MovementType[];

  limit?: number;

  offset?: number;
}
