import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria, OrderType } from '@shared';
import {
  PageRequest,
  PendingReviewFinder,
} from '@ledger/transactions/application/ports/pending-review-finder.port';
import { PendingReviewView } from '@ledger/transactions/application/views/pending-review.view';
import {
  PROJ_PENDING_REVIEW,
  PendingReviewRow,
  toPendingReviewView,
} from '@ledger/transactions/infrastructure/projections/pending-review.schema';

/** Serves {@link PendingReviewFinder} from `proj_pending_review` (INV-9). */
@Injectable()
export class ReadModelPendingReviewFinder extends PendingReviewFinder {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async list(userId: string, page: PageRequest): Promise<readonly PendingReviewView[]> {
    const rows = await this.store.query<PendingReviewRow>(
      PROJ_PENDING_REVIEW,
      Criteria.none()
        .equals('user_id', userId)
        .orderBy('date', OrderType.ASC)
        .paginate({ offset: page.offset, limit: page.limit }),
    );

    return rows.map(toPendingReviewView);
  }
}
