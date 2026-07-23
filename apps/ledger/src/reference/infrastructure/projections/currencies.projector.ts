import { Injectable } from '@nestjs/common';
import { Projector } from '../../../shared-kernel/application/projection/projector';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';
import { CurrencyRegistered } from '../../domain/currency/entities/currency.aggregate';

@Injectable()
export class CurrenciesProjector extends Projector {
  constructor(protected readonly readModelStore: ReadModelStore) {
    super();
  }

  async project(event: DomainEvent): Promise<void> {
    if (event instanceof CurrencyRegistered) {
      await this.readModelStore.upsert('proj_currencies', {
        code: event.code,
        minor_units: event.minorUnits,
        name: event.name,
        updated_at: new Date(),
      });
    }
  }
}
