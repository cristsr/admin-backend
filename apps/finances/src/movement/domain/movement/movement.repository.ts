import { Nullable } from '@shared';
import { Movement } from './movement.entity';
import { MovementType } from './movement.types';

export interface MovementQuery {
  startDate: Date;
  endDate: Date;
  user: number;
  account?: number;
  category?: number;
  type?: MovementType[];
  take?: number;
  skip?: number;
}

export interface MovementSumQuery {
  user: number;
  category: number;
  startDate: Date;
  endDate: Date;
  type: MovementType;
  account?: number;
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

  abstract sumAmount(query: MovementSumQuery): Promise<number>;
}
