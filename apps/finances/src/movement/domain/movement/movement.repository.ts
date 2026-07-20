import { Criteria, Nullable } from '@shared';
import { EntityManager } from 'typeorm';
import { MovementField } from './movement.criteria';
import { Movement } from './movement.entity';

/**
 * Reads are expressed as criteria rather than as one method per question. The
 * questions themselves did not disappear — they moved to `MovementCriteria`,
 * where they are stated in domain terms and can be composed, instead of
 * growing this port by one signature every time a screen needs a new filter.
 */
export abstract class MovementRepository {
  abstract matching(criteria: Criteria<MovementField>): Promise<Movement[]>;

  /**
   * The first match, honouring the criteria's own ordering. `null` when
   * nothing matches — an empty result is an answer, not a failure.
   */
  abstract firstMatching(
    criteria: Criteria<MovementField>,
  ): Promise<Nullable<Movement>>;

  abstract countMatching(criteria: Criteria<MovementField>): Promise<number>;

  /**
   * Total of the `amount` column over the matches, as a plain number: the
   * repository has no way to know which currency labels it, so the caller —
   * which put the currency filter in the criteria — mints the `Money`.
   */
  abstract sumAmount(criteria: Criteria<MovementField>): Promise<number>;

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

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(criteria: Criteria<MovementField>): Promise<number>;
}
