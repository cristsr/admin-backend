import { Command } from '@cqrs/application/command-bus/command';

/**
 * Resolves a confirmed discrepancy with a system adjustment. Idempotent
 * by the `externalRef` carried on the {@link AuthContext}, not on the command.
 */
export class ResolveDiscrepancyCommand extends Command {
  readonly commandType = 'ResolveDiscrepancy';

  constructor(readonly assertionId: string) {
    super();
  }
}
