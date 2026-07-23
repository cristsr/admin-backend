/** Revokes an erroneous assertion with an audited reason (RF-19). */
export class RevokeAssertionCommand {
  constructor(
    readonly assertionId: string,
    readonly reason: string,
  ) {}
}
