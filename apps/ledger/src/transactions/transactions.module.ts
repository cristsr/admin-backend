import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MergePendingTransfersHandler } from './application/commands/merge-pending-transfers.handler';
import { TransferCandidatesProjector } from './application/projectors/transfer-candidates.projector';
import { ListTransferCandidatesHandler } from './application/queries/list-transfer-candidates.query';
import { transferDetectionConfig } from './config/transfer-detection.config';
import { TransferCandidateStore } from './domain/ports/transfer-candidate-store.port';
import {
  TRANSFER_DETECTION_CONFIG,
  TransferDetector,
} from './domain/services/transfer-detector.service';
import { TransferController } from './infrastructure/adapters/http/transfer.controller';
import { InMemoryTransferCandidateStore } from './infrastructure/adapters/persistence/in-memory/in-memory-transfer-candidate-store';

/**
 * EP-3.7 additions to the transactions module: transfer detection projection and
 * the merge command. The assumed EP-1/EP-2 collaborators (`CommandBus`,
 * `QueryBus`, `AccountLookup`) and the real `LedgerTransaction` aggregate are
 * provided at integration; the in-memory candidate store is the placeholder the
 * TypeORM adapter replaces.
 */
@Module({
  imports: [ConfigModule.forFeature(transferDetectionConfig)],
  controllers: [TransferController],
  providers: [
    TransferDetector,
    { provide: TRANSFER_DETECTION_CONFIG, useFactory: () => transferDetectionConfig() },
    { provide: TransferCandidateStore, useClass: InMemoryTransferCandidateStore },
    TransferCandidatesProjector,
    MergePendingTransfersHandler,
    ListTransferCandidatesHandler,
  ],
})
export class TransactionsModule {}
