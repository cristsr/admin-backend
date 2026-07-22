import { Criteria, Nullable } from '@shared';
import { EntityManager } from 'typeorm';
import { MovementField } from '../criteria/movement-field.type';
import { Movement } from '../entities/movement.entity';

/**
 * Reads are expressed as composable criteria; the named queries live in the
 * `MovementLookups`, `MovementListing` and `MovementReports` classes.
 */
export abstract class MovementRepository {
  abstract matching(criteria: Criteria<MovementField>): Promise<Movement[]>;

  /** First match honouring the criteria's ordering; `null` when nothing matches. */
  abstract firstMatching(criteria: Criteria<MovementField>): Promise<Nullable<Movement>>;

  abstract countMatching(criteria: Criteria<MovementField>): Promise<number>;

  /**
   * Sum of `amount` over the matches as a plain number; the caller owns the
   * currency and mints the `Money`.
   */
  abstract sumAmount(criteria: Criteria<MovementField>): Promise<number>;

  abstract save(movement: Movement): Promise<Movement>;

  /**
   * Runs `work` in a single transaction so the movement and its outbox event
   * commit together.
   */
  abstract runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T>;

  abstract saveWithManager(manager: EntityManager, movement: Movement): Promise<Movement>;

  /** Saves several movements atomically: both legs of a transfer exist, or neither. */
  abstract saveAll(movements: Movement[]): Promise<Movement[]>;

  /** Soft-deletes every match and returns how many rows it touched. */
  abstract removeMatching(criteria: Criteria<MovementField>): Promise<number>;
}
