import { Injectable } from '@nestjs/common';
import { ChainHashInput } from '@cqrs/domain/event/chain-hash-input.type';
import { ChainRow } from '@cqrs/domain/event/chain-row.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { DataSource } from 'typeorm';

type ChainQueryRow = {
  readonly global_position: string;
  readonly event_id: string;
  readonly user_id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly sequence: string;
  readonly event_type: string;
  readonly schema_version: number;
  readonly client_id: string;
  readonly external_ref: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurred_at: Date;
  readonly hash: string;
};

const CHAIN_COLUMNS = `
  global_position, event_id, user_id, aggregate_type, aggregate_id, sequence,
  event_type, schema_version, client_id, external_ref, payload, occurred_at, hash
`;

/** Reads the chain the same way {@link PostgresEventStore} wrote it — the only place `hash` leaves the adapter. */
@Injectable()
export class PostgresEventChainReader extends EventChainReader {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async readChain(userId: string, fromPosition: bigint, limit: number): Promise<readonly ChainRow[]> {
    const rows: ChainQueryRow[] = await this.dataSource.query(
      `SELECT ${CHAIN_COLUMNS} FROM event_store
       WHERE user_id = $1 AND global_position > $2
       ORDER BY global_position ASC LIMIT $3`,
      [userId, fromPosition.toString(), limit],
    );

    return rows.map((row) => ({
      globalPosition: BigInt(row.global_position),
      eventId: row.event_id,
      hash: row.hash,
      chainInput: this.toChainHashInput(row),
    }));
  }

  async userIds(): Promise<readonly string[]> {
    const rows: { user_id: string }[] = await this.dataSource.query(
      'SELECT DISTINCT user_id FROM event_store ORDER BY user_id',
    );

    return rows.map((row) => row.user_id);
  }

  private toChainHashInput(row: ChainQueryRow): ChainHashInput {
    return {
      eventId: row.event_id,
      userId: row.user_id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      sequence: Number(row.sequence),
      eventType: row.event_type,
      schemaVersion: row.schema_version,
      clientId: row.client_id,
      externalRef: row.external_ref,
      payload: row.payload,
      occurredAt: new Date(row.occurred_at).toISOString(),
    };
  }
}
