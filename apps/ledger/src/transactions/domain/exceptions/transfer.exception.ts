import { DomainNotFoundException, DomainUnprocessableException } from '@shared';

/** The two pending transactions do not form a valid transfer pair (RF-16). */
export class NotATransferPairException extends DomainUnprocessableException {
  readonly code = 'NOT_A_TRANSFER_PAIR';
}

/** One of the referenced pending transactions does not exist as a pending leg. */
export class PendingLegNotFoundException extends DomainNotFoundException {
  readonly code = 'PENDING_LEG_NOT_FOUND';
}
