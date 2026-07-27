import { Command } from '@ledger/shared-kernel/application/command-bus/command';

/** Revokes an erroneous assertion with an audited reason (RF-19). */
export class RevokeAssertionCommand extends Command {
  readonly commandType = 'RevokeAssertion';

  constructor(
    readonly assertionId: string,
    readonly reason: string,
  ) {
    super();
  }
}
