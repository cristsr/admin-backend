import { Command } from '@ledger/shared-kernel/application/command-bus/command';

/** Registers a currency in the global reference catalog (RF-21). */
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
