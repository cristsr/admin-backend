import { NewMovement } from './new-movement.type';

/** A movement ingested from an external provider, invoice data included. */
export interface IngestedMovement extends NewMovement {
  merchant: string;
  externalReference: string;
  invoiceNumber?: string;
  invoiceIssuer?: string;
  invoiceUrl?: string;
  invoiceIssuedAt?: Date;
}
