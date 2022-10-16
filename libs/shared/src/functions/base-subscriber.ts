import { Type } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface as EntitySubscriber,
} from 'typeorm';

export function BaseSubscriber<T>(target: Type<T>): Type<EntitySubscriber<T>> {
  class BaseSubscriber implements EntitySubscriber<T> {
    constructor(dataSource: DataSource) {
      dataSource.subscribers.push(this);
    }

    listenTo(): Type<T> {
      return target;
    }
  }

  return BaseSubscriber;
}
