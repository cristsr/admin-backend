import { PropertiesOnly } from '@shared';
import { Money } from '@app/shared/domain';
import { MovementNotEditableException } from './movement.exception';
import {
  MovementAccountSummary,
  MovementCategorySummary,
  MovementSource,
  MovementSubcategorySummary,
  MovementType,
  PaymentMethod,
} from './movement.types';

/**
 * Fields an ingested (WEBHOOK) movement allows editing: only what belongs to
 * the user, never what was extracted by ingestion.
 */
const INGESTION_EDITABLE = new Set<keyof MovementPatch>([
  'notes',
  'categoryId',
  'subcategoryId',
  'paymentMethod',
]);

const TRANSFER_TYPES = new Set<MovementType>([
  MovementType.TRANSFER_IN,
  MovementType.TRANSFER_OUT,
]);

/** What a user is allowed to change on an existing movement. */
export interface MovementPatch {
  date?: Date;
  description?: string;
  notes?: string;
  amount?: number;
  paymentMethod?: PaymentMethod;
  categoryId?: number;
  subcategoryId?: number;
}

/** Everything a movement needs to exist, whatever recorded it. */
export interface NewMovement {
  date: Date;
  type: MovementType;
  description: string;
  money: Money;
  accountId: number;
  user: number;
  categoryId?: number;
  subcategoryId?: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
}

/** A movement ingested from an external provider, invoice data included. */
interface IngestedMovement extends NewMovement {
  merchant: string;
  externalReference: string;
  invoiceNumber?: string;
  invoiceIssuer?: string;
  invoiceUrl?: string;
  invoiceIssuedAt?: Date;
}

/** One side of a transfer; both sides share the same group. */
interface TransferLeg {
  date: Date;
  type: MovementType;
  description: string;
  money: Money;
  accountId: number;
  user: number;
  transferGroup: string;
}

export class Movement {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  /**
   * Who charged. Kept apart from `description` so editing the note never
   * destroys the merchant the ingestion extracted.
   */
  merchant?: string;

  /** Free-form note owned by the user. */
  notes?: string;

  /** How much moved, in the currency of the account holding it. */
  money: Money;

  paymentMethod?: PaymentMethod;

  source: MovementSource;

  categoryId: number;

  category?: MovementCategorySummary;

  subcategoryId?: number;

  subcategory?: MovementSubcategorySummary;

  accountId: number;

  account?: MovementAccountSummary;

  /**
   * Id of the transaction in the source system — exists for idempotent
   * delivery, and is not a pointer to the invoice document.
   */
  externalReference?: string;

  /**
   * Ties the two legs of a transfer together. Both legs share it, so one can
   * be reached from the other.
   */
  transferGroup?: string;

  /**
   * Source invoice this movement was extracted from, when there is one.
   * One invoice maps to exactly one movement.
   */
  invoiceNumber?: string;

  invoiceIssuer?: string;

  invoiceUrl?: string;

  invoiceIssuedAt?: Date;

  user: number;

  private constructor(payload?: Partial<Movement>) {
    Object.assign(this, payload);
  }

  /**
   * Rehydrates a movement from stored state. Recording a *new* movement goes
   * through one of the named constructors instead, so its source can never be
   * left to the caller's memory.
   */
  static create(payload: PropertiesOnly<Movement>): Movement {
    return new Movement(payload);
  }

  /** Recorded by the user by hand. */
  static manual(payload: NewMovement): Movement {
    return new Movement({ ...payload, source: MovementSource.MANUAL });
  }

  /** Ingested from an external provider through the webhook. */
  static fromWebhook(payload: IngestedMovement): Movement {
    return new Movement({ ...payload, source: MovementSource.WEBHOOK });
  }

  /** Materialized by the cron from a scheduled entry. */
  static fromSchedule(payload: NewMovement): Movement {
    return new Movement({ ...payload, source: MovementSource.SCHEDULED });
  }

  /**
   * One leg of a transfer. A leg is never income or expense — the reports skip
   * both types — and it belongs to a group, not to a category.
   */
  static transferLeg(payload: TransferLeg): Movement {
    return new Movement({ ...payload, source: MovementSource.MANUAL });
  }

  update(payload: Partial<PropertiesOnly<Movement>>): void {
    Object.assign(this, payload);
  }

  isTransferLeg(): boolean {
    return TRANSFER_TYPES.has(this.type);
  }

  /** Its data was extracted by ingestion, so most of it is not the user's to edit. */
  isIngested(): boolean {
    return this.source === MovementSource.WEBHOOK;
  }

  /**
   * Applies a user edit, refusing anything that would break an invariant: a
   * transfer leg is only undone by reversing the transfer, and an ingested
   * movement only exposes the fields the user owns (AC-4). `type` and currency
   * are absent from the patch by design — neither is editable.
   */
  applyPatch(patch: MovementPatch): void {
    this.ensureEditable(patch);

    this.date = patch.date ?? this.date;
    this.description = patch.description ?? this.description;
    this.notes = patch.notes ?? this.notes;
    this.paymentMethod = patch.paymentMethod ?? this.paymentMethod;
    this.categoryId = patch.categoryId ?? this.categoryId;
    this.subcategoryId = patch.subcategoryId ?? this.subcategoryId;

    if (patch.amount !== undefined) {
      this.money = Money.of(patch.amount, this.money.currency);
    }
  }

  /**
   * The compensating leg that cancels this one: same amount on the same
   * account, opposite direction, filed under the reversal's own group so a
   * second attempt can be recognized as a duplicate.
   */
  reversalLeg(transferGroup: string, description: string): Movement {
    return Movement.transferLeg({
      date: new Date(),
      type: this.oppositeTransferType(),
      description,
      money: this.money,
      accountId: this.accountId,
      user: this.user,
      transferGroup,
    });
  }

  /**
   * The compensating movement that cancels an ingested one that should never
   * have been recorded: same amount and category, opposite direction. It keeps
   * its own external reference, derived from the original, which is what makes
   * a repeated reversal recognizable instead of duplicated.
   */
  reversal(externalReference: string): Movement {
    return Movement.fromWebhook({
      date: new Date(),
      type: this.oppositeFlowType(),
      description: `Reversal of ${this.externalReference}`,
      merchant: this.merchant,
      money: this.money,
      categoryId: this.categoryId,
      subcategoryId: this.subcategoryId,
      accountId: this.accountId,
      user: this.user,
      externalReference,
    });
  }

  private oppositeFlowType(): MovementType {
    return this.type === MovementType.EXPENSE
      ? MovementType.INCOME
      : MovementType.EXPENSE;
  }

  private oppositeTransferType(): MovementType {
    return this.type === MovementType.TRANSFER_OUT
      ? MovementType.TRANSFER_IN
      : MovementType.TRANSFER_OUT;
  }

  private ensureEditable(patch: MovementPatch): void {
    if (this.isTransferLeg()) {
      throw new MovementNotEditableException(
        'Transfer legs cannot be edited; reverse the transfer instead',
      );
    }

    if (!this.isIngested()) return;

    const forbidden = Object.keys(patch).filter(
      (field) =>
        patch[field] !== undefined &&
        !INGESTION_EDITABLE.has(field as keyof MovementPatch),
    );

    if (!forbidden.length) return;

    throw new MovementNotEditableException(
      `Fields extracted by ingestion are read-only: ${forbidden.join(', ')}`,
    );
  }
}
