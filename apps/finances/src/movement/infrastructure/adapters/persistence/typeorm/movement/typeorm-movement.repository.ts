import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { Between, In, Repository } from 'typeorm';
import {
  Movement,
  MovementQuery,
  MovementRepository,
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

  async findAll(filter: MovementQuery): Promise<Movement[]> {
    const entities = await this.repository.find({
      where: {
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

  async remove(id: number, user: number): Promise<boolean> {
    const result = await this.repository.softDelete({ id, user });
    return !!result.affected;
  }

  async sumAmountByCategoryAndDateRange(
    categoryId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .select('sum(amount)', 'spent')
        .where({
          category: categoryId,
          date: Between(startDate, endDate),
        })
        .getRawOne();
      return +result.spent || 0;
    } catch {
      return 0;
    }
  }
}
