import { Injectable, Type } from '@nestjs/common';
import { DataSource, EntityTarget, Repository } from 'typeorm';

export function EntityRepository<T>(
  entity: EntityTarget<T>
): Type<Repository<T>> {
  @Injectable()
  class BaseRepository extends Repository<T> {
    constructor(protected dataSource: DataSource) {
      super(entity, dataSource.createEntityManager());
    }
  }

  return BaseRepository;
}
