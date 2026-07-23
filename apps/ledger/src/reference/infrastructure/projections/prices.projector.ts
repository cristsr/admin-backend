import { Injectable } from '@nestjs/common';
import { Projector } from '../../../shared-kernel/application/projection/projector';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';
import { PriceRecorded } from '../../domain/price/entities/price-feed.aggregate';

@Injectable()
export class PricesProjector extends Projector {
  constructor(protected readonly readModelStore: ReadModelStore) {
    super();
  }

  async project(event: DomainEvent): Promise<void> {
    if (event instanceof PriceRecorded) {
      // Last-write-wins via global_position; projector inserts with global_position from context
      await this.readModelStore.upsert('proj_prices', {
        base: event.base,
        quote: event.quote,
        date: event.date,
        rate: event.rate,
        source: event.source,
        updated_at: new Date(),
      });
    }
  }
}
