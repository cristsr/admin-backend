import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { Between, Repository } from 'typeorm';
import {
  Scheduled,
  ScheduledQuery,
  ScheduledRepository,
} from '../../../../../domain/scheduled';
import { TypeOrmScheduledEntity } from './typeorm-scheduled.entity';
import { TypeOrmScheduledMapper } from './typeorm-scheduled.mapper';

@Injectable()
export class TypeOrmScheduledRepository implements ScheduledRepository {
  constructor(
    @InjectRepository(TypeOrmScheduledEntity)
    private readonly repository: Repository<TypeOrmScheduledEntity>,
  ) {}

  async findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<Scheduled>> {
    const entity = await this.repository.findOne({
      where: { id, user },
      relations: ['category', 'subcategory'],
    });
    return entity ? TypeOrmScheduledMapper.toDomain(entity) : null;
  }

  async findAll(filter: ScheduledQuery): Promise<Scheduled[]> {
    const entities = await this.repository.find({
      where: {
        user: filter.user,
        account: { id: filter.account },
        active: filter.active,
      },
      relations: ['category', 'subcategory'],
      take: filter.take,
      skip: filter.skip,
    });
    return entities.map(TypeOrmScheduledMapper.toDomain);
  }

  async findDueAt(minuteStart: Date, minuteEnd: Date): Promise<Scheduled[]> {
    const entities = await this.repository.find({
      where: {
        date: Between(minuteStart, minuteEnd),
        active: true,
        repeat: true,
      },
    });
    return entities.map(TypeOrmScheduledMapper.toDomain);
  }

  async save(scheduled: Scheduled): Promise<Scheduled> {
    const saved = await this.repository.save(
      TypeOrmScheduledMapper.toEntity(scheduled),
    );
    return TypeOrmScheduledMapper.toDomain(saved as TypeOrmScheduledEntity);
  }

  async remove(id: number, user: number): Promise<boolean> {
    const result = await this.repository.softDelete({ id, user });
    return !!result.affected;
  }
}
