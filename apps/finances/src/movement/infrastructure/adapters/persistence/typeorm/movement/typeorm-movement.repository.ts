import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Criteria, Nullable, TypeOrmCriteriaConverter } from '@shared';
import { EntityManager, Repository } from 'typeorm';
import {
  Movement,
  MovementField,
  MovementRepository,
} from '@app/movement/domain/movement';
import { MOVEMENT_CRITERIA_FIELDS } from './typeorm-movement.criteria-fields';
import { TypeOrmMovementEntity } from './typeorm-movement.entity';
import { TypeOrmMovementMapper } from './typeorm-movement.mapper';

/** Relations every movement is read with, so the mapper can build its summaries. */
const RELATIONS = ['category', 'subcategory'];

@Injectable()
export class TypeOrmMovementRepository implements MovementRepository {
  readonly #criteria = new TypeOrmCriteriaConverter<
    TypeOrmMovementEntity,
    MovementField
  >(MOVEMENT_CRITERIA_FIELDS);

  constructor(
    @InjectRepository(TypeOrmMovementEntity)
    private readonly repository: Repository<TypeOrmMovementEntity>,
  ) {}

  async matching(criteria: Criteria<MovementField>): Promise<Movement[]> {
    const entities = await this.repository.find({
      ...this.#criteria.toFindOptions(criteria),
      relations: RELATIONS,
    });

    return entities.map(TypeOrmMovementMapper.toDomain);
  }

  async firstMatching(
    criteria: Criteria<MovementField>,
  ): Promise<Nullable<Movement>> {
    const entity = await this.repository.findOne({
      ...this.#criteria.toFindOptions(criteria),
      relations: RELATIONS,
    });

    return entity ? TypeOrmMovementMapper.toDomain(entity) : null;
  }

  async countMatching(criteria: Criteria<MovementField>): Promise<number> {
    return this.repository.countBy(this.#criteria.toWhere(criteria));
  }

  async sumAmount(criteria: Criteria<MovementField>): Promise<number> {
    // `sum` answers null when nothing matched; an empty period has spent zero.
    const total = await this.repository.sum(
      'amount',
      this.#criteria.toWhere(criteria),
    );

    return total ?? 0;
  }

  async save(movement: Movement): Promise<Movement> {
    const saved = await this.repository.save(
      TypeOrmMovementMapper.toEntity(movement),
    );
    const entity = await this.repository.findOne({
      where: { id: saved.id },
      relations: RELATIONS,
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
      relations: RELATIONS,
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

  async removeMatching(criteria: Criteria<MovementField>): Promise<number> {
    const result = await this.repository.softDelete(
      this.#criteria.toWhere(criteria),
    );

    return result.affected ?? 0;
  }
}
