import { Command } from '@cqrs/application/command-bus/command';

/** Revokes an erroneous assertion with an audited reason. */
export class RevokeAssertionCommand extends Command {
  readonly commandType = 'RevokeAssertion';

  constructor(
    readonly assertionId: string,
    readonly reason: string,
  ) {
    super();
  }
}
