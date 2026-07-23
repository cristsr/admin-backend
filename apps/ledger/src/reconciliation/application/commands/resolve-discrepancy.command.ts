/**
 * Resolves a confirmed discrepancy with a system adjustment (RF-20). Idempotent
 * by the `externalRef` carried on the {@link AuthContext}, not on the command.
 */
export class ResolveDiscrepancyCommand {
  constructor(readonly assertionId: string) {}
}
