import { Nullable } from '@shared';
import { Movement } from './movement.entity';
import { MovementType } from './movement.types';

export interface MovementQuery {
  startDate: Date;
  endDate: Date;
  account?: number;
  category?: number;
  type?: MovementType[];
  take?: number;
  skip?: number;
}

export abstract class MovementRepository {
  abstract findById(id: number): Promise<Nullable<Movement>>;

  abstract findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<Movement>>;

  abstract findByExternalReference(
    externalReference: string,
  ): Promise<Nullable<Movement>>;

  abstract findAll(filter: MovementQuery): Promise<Movement[]>;

  abstract save(movement: Movement): Promise<Movement>;

  abstract remove(id: number, user: number): Promise<boolean>;

  abstract sumAmountByCategoryAndDateRange(
    categoryId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;
}
