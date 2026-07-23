import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '../../../shared-kernel/application/command/command-handler';
import { EventStore } from '../../../shared-kernel/domain/ports/event-store';
import { RecordPriceCommand } from '../commands/record-price.command';
import { PriceFeed } from '../../domain/price/entities/price-feed.aggregate';
import { ExchangeRate } from '../../domain/price/value-objects/exchange-rate.vo';

@Injectable()
@CommandHandler(RecordPriceCommand)
export class RecordPriceHandler implements ICommandHandler<RecordPriceCommand> {
  constructor(private readonly eventStore: EventStore) {}

  async handle(command: RecordPriceCommand): Promise<void> {
    ExchangeRate.of(command.rate); // Validate
    const id = `${command.base}/${command.quote}/${command.date}/${command.source}`;
    const feed = PriceFeed.record(
      command.base,
      command.quote,
      command.date,
      command.rate,
      command.source,
    );
    await this.eventStore.append(id, feed.domainEvents);
  }
}
