import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral } from '@shared';
import { Repository } from 'typeorm';
import {
  IdempotencyKey,
  IdempotencyRepository,
  IdempotencyReservation,
  IdempotencyStatus,
} from '@app/idempotency/domain/idempotency-key';
import { TypeOrmIdempotencyKeyEntity } from './typeorm-idempotency-key.entity';

@Injectable()
export class TypeOrmIdempotencyRepository implements IdempotencyRepository {
  constructor(
    @InjectRepository(TypeOrmIdempotencyKeyEntity)
    private readonly repository: Repository<TypeOrmIdempotencyKeyEntity>,
  ) {}

  async reserve(reservation: IdempotencyReservation): Promise<{ created: boolean; row: IdempotencyKey }> {
    // The unique index + ON CONFLICT DO NOTHING keeps concurrent inserts race-safe.
    const insert = await this.repository
      .createQueryBuilder()
      .insert()
      .into(TypeOrmIdempotencyKeyEntity)
      .values({
        idempotencyKey: reservation.idempotencyKey,
        userId: reservation.userId,
        endpoint: reservation.endpoint,
        requestHash: reservation.requestHash,
        status: IdempotencyStatus.PENDING,
        expiresAt: reservation.expiresAt,
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    // No rows returned when the key already existed.
    const created = Array.isArray(insert.raw) && insert.raw.length > 0;

    const entity = await this.repository.findOne({
      where: {
        userId: reservation.userId,
        idempotencyKey: reservation.idempotencyKey,
      },
    });

    return { created, row: this.toDomain(entity) };
  }

  async complete(id: number, responseStatus: number, responseBody: ObjectLiteral): Promise<void> {
    await this.repository.update(id, {
      status: IdempotencyStatus.COMPLETED,
      responseStatus,
      responseBody,
    });
  }

  async release(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(TypeOrmIdempotencyKeyEntity)
      .where('expires_at < :now', { now })
      .execute();

    return result.affected ?? 0;
  }

  private toDomain(entity: TypeOrmIdempotencyKeyEntity): IdempotencyKey {
    return IdempotencyKey.create({
      id: entity.id,
      idempotencyKey: entity.idempotencyKey,
      userId: entity.userId,
      endpoint: entity.endpoint,
      requestHash: entity.requestHash,
      status: entity.status as IdempotencyStatus,
      responseStatus: entity.responseStatus,
      responseBody: entity.responseBody,
      createdAt: entity.createdAt,
      expiresAt: entity.expiresAt,
    });
  }
}
