import { Command } from '@cqrs/application/command-bus/command';

/** Registers a currency in the global reference catalog. */
export class RegisterCurrencyCommand extends Command {
  readonly commandType = 'RegisterCurrency';

  constructor(
    readonly code: string,
    readonly minorUnits: number,
    readonly name: string,
  ) {
    super();
  }
}
