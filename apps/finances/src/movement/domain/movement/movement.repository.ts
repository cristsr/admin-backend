import { Nullable } from '@shared';
import { EntityManager } from 'typeorm';
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

  /**
   * Both legs (or the compensating pair) that share a transferGroup, scoped
   * to the user.
   */
  abstract findByTransferGroup(
    transferGroup: string,
    user: number,
  ): Promise<Movement[]>;

  abstract findAll(filter: MovementQuery): Promise<Movement[]>;

  abstract save(movement: Movement): Promise<Movement>;

  /**
   * Runs `work` inside a single database transaction, exposing the manager so
   * the movement and its outbox event commit together (AC-2, sm-0003).
   */
  abstract runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T>;

  /** Saves a movement using the given transaction manager. */
  abstract saveWithManager(
    manager: EntityManager,
    movement: Movement,
  ): Promise<Movement>;

  /**
   * Saves several movements atomically. The legs of a transfer must both
   * exist or neither: half a transfer would make money disappear.
   */
  abstract saveAll(movements: Movement[]): Promise<Movement[]>;

  abstract remove(id: number, user: number): Promise<boolean>;

  abstract sumAmount(query: MovementSumQuery): Promise<number>;
}
