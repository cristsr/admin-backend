import { Command } from '@cqrs/application/command-bus/command';

/** Reverses a CONFIRMED transaction via a linked reversing transaction. */
export class ReverseConfirmedTransactionCommand extends Command {
  readonly commandType = 'ReverseConfirmedTransaction';

  constructor(
    readonly transactionId: string,
    /**
     * `true`: T2 is dated at the original's date (corrects the historical
     * balance). `false`: T2 is dated today. Required (not optional): the
     * controller resolves the default so the idempotency hash is always
     * stable — hu-0026 (AC-5).
     */
    readonly atEffectiveDate: boolean,
  ) {
    super();
  }
}
