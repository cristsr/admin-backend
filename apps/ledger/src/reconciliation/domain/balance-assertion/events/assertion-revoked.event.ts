/** Stable event-type name for a revocation (spec §3.4). */
export const ASSERTION_REVOKED = 'AssertionRevoked';

/** Payload of an assertion revocation; the reason is audited in the stream. */
export class AssertionRevoked {
  constructor(readonly reason: string) {}
}
