import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '../../../shared-kernel/application/command/command-handler';
import { EventStore } from '../../../shared-kernel/domain/ports/event-store';
import { RegisterCurrencyCommand } from '../commands/register-currency.command';
import { Currency } from '../../domain/currency/entities/currency.aggregate';
import { CurrencyCode } from '../../domain/currency/value-objects/currency-code.vo';
import { MinorUnits } from '../../domain/currency/value-objects/minor-units.vo';

@Injectable()
@CommandHandler(RegisterCurrencyCommand)
export class RegisterCurrencyHandler implements ICommandHandler<RegisterCurrencyCommand> {
  constructor(private readonly eventStore: EventStore) {}

  async handle(command: RegisterCurrencyCommand): Promise<void> {
    const code = CurrencyCode.of(command.code).value;
    const minorUnits = MinorUnits.of(command.minorUnits).value;
    const currency = Currency.register(code, minorUnits, command.name);
    await this.eventStore.append(code, currency.domainEvents);
  }
}
