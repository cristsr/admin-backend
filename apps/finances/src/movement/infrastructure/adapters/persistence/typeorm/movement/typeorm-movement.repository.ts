import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { Between, In, Repository } from 'typeorm';
import {
  Movement,
  MovementQuery,
  MovementRepository,
  MovementSumQuery,
} from '../../../../../domain/movement';
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

  async sumAmount(query: MovementSumQuery): Promise<number> {
    const builder = this.repository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.amount), 0)', 'total')
      .where('m.user_id = :user', { user: query.user })
      .andWhere('m.category_id = :category', { category: query.category })
      .andWhere('m.type = :type', { type: query.type })
      .andWhere('m.date BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      })
      .andWhere('m.deleted_at IS NULL');

    if (query.account) {
      builder.andWhere('m.account_id = :account', { account: query.account });
    }

    const result = await builder.getRawOne<{ total: string }>();

    return Number(result.total);
  }
}
