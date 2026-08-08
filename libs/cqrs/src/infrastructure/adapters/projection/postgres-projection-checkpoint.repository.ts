import { Injectable } from '@nestjs/common';
import { ProjectionCheckpointRepository } from '@cqrs/application/projection/projection-checkpoint.repository';
import { DataSource } from 'typeorm';

/** Shape of a `projection_checkpoints` row as the driver returns it. */
interface CheckpointRow {
  readonly last_position: string;
}

/**
 * PostgreSQL {@link ProjectionCheckpointRepository} over `projection_checkpoints`
 *. Positions survive restarts, so an async projection resumes where it
 * left off instead of replaying the whole stream, and the gap to the stream head
 * is readable as projection lag.
 *
 * `last_position` is `BIGINT`: the driver hands it back as a string and it is
 * parsed with `BigInt`, never `Number` — global positions outgrow `Number`'s
 * safe integer range.
 */
@Injectable()
export class PostgresProjectionCheckpointRepository extends ProjectionCheckpointRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async lastPosition(projectionName: string): Promise<bigint> {
    const rows = await this.dataSource.query<CheckpointRow[]>(
      'SELECT last_position FROM projection_checkpoints WHERE projection_name = $1',
      [projectionName],
    );

    if (!rows.length) return 0n; // guard: a projection that never ran starts at zero

    return BigInt(rows[0].last_position);
  }

  async advance(projectionName: string, position: bigint): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO projection_checkpoints (projection_name, last_position, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (projection_name)
       DO UPDATE SET last_position = EXCLUDED.last_position, updated_at = now()`,
      [projectionName, position.toString()],
    );
  }
}
