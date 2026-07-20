import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { Between, EntityManager, In, Repository } from 'typeorm';
import {
  Movement,
  MovementQuery,
  MovementRepository,
  MovementSumQuery,
} from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { TypeOrmMovementEntity } from './typeorm-movement.entity';
import { TypeOrmMovementMapper } from './typeorm-movement.mapper';

@Injectable()
export class TypeOrmMovementRepository implements MovementRepository {
  constructor(
    @InjectRepository(TypeOrmMovementEntity)
    private readonly repository: Repository<TypeOrmMovementEntity>,
  ) {}

  async findById(id: number): Promise<Nullable<Movement>> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['category', 'subcategory'],
    });
    return entity ? TypeOrmMovementMapper.toDomain(entity) : null;
  }

  async findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<Movement>> {
    const entity = await this.repository.findOne({
      where: { id, user },
      relations: ['category', 'subcategory'],
    });
    return entity ? TypeOrmMovementMapper.toDomain(entity) : null;
  }

  async findByExternalReference(
    externalReference: string,
  ): Promise<Nullable<Movement>> {
    const entity = await this.repository.findOne({
      where: { externalReference },
      relations: ['category', 'subcategory'],
    });
    return entity ? TypeOrmMovementMapper.toDomain(entity) : null;
  }

  async findByTransferGroup(
    transferGroup: string,
    user: number,
  ): Promise<Movement[]> {
    const entities = await this.repository.find({
      where: { transferGroup, user },
      relations: ['category', 'subcategory'],
      order: { type: 'ASC' },
    });
    return entities.map(TypeOrmMovementMapper.toDomain);
  }

  async findAll(filter: MovementQuery): Promise<Movement[]> {
    const entities = await this.repository.find({
      where: {
        user: filter.user,
        date: Between(filter.startDate, filter.endDate),
        category: { id: filter.category },
        account: { id: filter.account },
        type: filter.type?.length ? In(filter.type) : null,
      },
      order: {
        date: 'DESC',
        createdAt: 'DESC',
      },
      relations: ['category', 'subcategory'],
      take: filter.take,
      skip: filter.skip,
    });

    return entities.map(TypeOrmMovementMapper.toDomain);
  }

  async save(movement: Movement): Promise<Movement> {
    const saved = await this.repository.save(
      TypeOrmMovementMapper.toEntity(movement),
    );
    const entity = await this.repository.findOne({
      where: { id: saved.id },
      relations: ['category', 'subcategory'],
    });
    return TypeOrmMovementMapper.toDomain(entity);
  }

  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.repository.manager.transaction(work);
  }

  async saveWithManager(
    manager: EntityManager,
    movement: Movement,
  ): Promise<Movement> {
    const saved = await manager.save(
      TypeOrmMovementEntity,
      TypeOrmMovementMapper.toEntity(movement),
    );
    const entity = await manager.findOne(TypeOrmMovementEntity, {
      where: { id: saved.id },
      relations: ['category', 'subcategory'],
    });
    return TypeOrmMovementMapper.toDomain(entity);
  }

  async saveAll(movements: Movement[]): Promise<Movement[]> {
    return this.repository.manager.transaction(async (manager) => {
      const saved = await manager.save(
        TypeOrmMovementEntity,
        movements.map(TypeOrmMovementMapper.toEntity),
      );
      return saved.map((entity) =>
        TypeOrmMovementMapper.toDomain(entity as TypeOrmMovementEntity),
      );
    });
  }

  async remove(id: number, user: number): Promise<boolean> {
    const result = await this.repository.softDelete({ id, user });
    return !!result.affected;
  }

  async sumAmount(query: MovementSumQuery): Promise<Money> {
    const builder = this.repository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.amount), 0)', 'total')
      .where('m.user_id = :user', { user: query.user })
      .andWhere('m.category_id = :category', { category: query.category })
      .andWhere('m.type = :type', { type: query.type })
      .andWhere('m.currency = :currency', { currency: query.currency })
      .andWhere('m.date BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      })
      .andWhere('m.deleted_at IS NULL');

    if (query.account) {
      builder.andWhere('m.account_id = :account', { account: query.account });
    }

    const result = await builder.getRawOne<{ total: string }>();

    return Money.of(Number(result.total), query.currency);
  }
}
