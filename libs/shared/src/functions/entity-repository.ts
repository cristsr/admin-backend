import { DataSource, Repository } from 'typeorm';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { Injectable, Type } from '@nestjs/common';

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
