import { PropertiesOnly } from '@shared';
import { Money } from '@app/shared/domain';
import { IngestedMovement } from './ingested-movement.type';
import { MovementPatch } from './movement-patch.type';
import { MovementNotEditableException } from './movement.exception';
import {
  MovementAccountSummary,
  MovementCategorySummary,
  MovementSource,
  MovementSubcategorySummary,
  MovementType,
  PaymentMethod,
} from './movement.types';
import { NewMovement } from './new-movement.type';
import { TransferLeg } from './transfer-leg.type';

/** Patch fields an ingested (WEBHOOK) movement allows: only user-owned ones. */
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

/** Types that take money out of the account holding them. */
const WITHDRAWAL_TYPES = new Set<MovementType>([
  MovementType.EXPENSE,
  MovementType.TRANSFER_OUT,
]);

export class Movement {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  /** Who charged; kept apart from `description` so user edits never lose it. */
  merchant?: string;

  notes?: string;

  money: Money;

  paymentMethod?: PaymentMethod;

  source: MovementSource;

  categoryId: number;

  category?: MovementCategorySummary;

  subcategoryId?: number;

  subcategory?: MovementSubcategorySummary;

  accountId: number;

  account?: MovementAccountSummary;

  /** Source-system transaction id, for idempotent delivery. */
  externalReference?: string;

  transferGroup?: string;

  /** Source invoice; one invoice maps to exactly one movement. */
  invoiceNumber?: string;

  invoiceIssuer?: string;

  invoiceUrl?: string;

  invoiceIssuedAt?: Date;

  user: number;

  private constructor(payload?: Partial<Movement>) {
    Object.assign(this, payload);
  }

  /**
   * Rehydrates from stored state; new movements use a named constructor so the
   * source is never left to the caller.
   */
  static create(payload: PropertiesOnly<Movement>): Movement {
    return new Movement(payload);
  }

  static manual(payload: NewMovement): Movement {
    return new Movement({ ...payload, source: MovementSource.MANUAL });
  }

  static fromWebhook(payload: IngestedMovement): Movement {
    return new Movement({ ...payload, source: MovementSource.WEBHOOK });
  }

  static fromSchedule(payload: NewMovement): Movement {
    return new Movement({ ...payload, source: MovementSource.SCHEDULED });
  }

  /** One leg of a transfer: belongs to a group, not to a category. */
  static transferLeg(payload: TransferLeg): Movement {
    return new Movement({ ...payload, source: MovementSource.MANUAL });
  }

  update(payload: Partial<PropertiesOnly<Movement>>): void {
    Object.assign(this, payload);
  }

  isTransferLeg(): boolean {
    return TRANSFER_TYPES.has(this.type);
  }

  /** Whether money leaves the account and must be funded before recording. */
  isWithdrawal(): boolean {
    return WITHDRAWAL_TYPES.has(this.type);
  }

  /** Effect on the account balance: negative when the money left. */
  signedAmount(): number {
    if (this.isWithdrawal()) return -this.money.amount;

    return this.money.amount;
  }

  isIngested(): boolean {
    return this.source === MovementSource.WEBHOOK;
  }

  /**
   * Applies a user edit. Refuses changes that break invariants: transfer legs
   * cannot be edited and ingestion-owned fields are read-only.
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
   * The compensating leg that cancels this one: same amount and account,
   * opposite direction, under the reversal's own group so retries are recognized.
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
   * The compensating movement that cancels an ingested one. Its own external
   * reference makes a repeated reversal recognizable.
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
