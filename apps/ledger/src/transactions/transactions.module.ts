import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MergePendingTransfersHandler } from './application/commands/merge-pending-transfers.handler';
import { TransferCandidatesProjector } from './application/projectors/transfer-candidates.projector';
import { ListTransferCandidatesHandler } from './application/queries/list-transfer-candidates.query';
import { transferDetectionConfig } from './config/transfer-detection.config';
import { AccountLookup } from './domain/ports/account-lookup.port';
import { TransferCandidateStore } from './domain/ports/transfer-candidate-store.port';
import {
  TRANSFER_DETECTION_CONFIG,
  TransferDetector,
} from './domain/services/transfer-detector.service';
import { TransferController } from './infrastructure/adapters/http/transfer.controller';
import { InMemoryTransferCandidateStore } from './infrastructure/adapters/persistence/in-memory/in-memory-transfer-candidate-store';
import { ReadModelAccountLookup } from './infrastructure/adapters/persistence/read-model-account-lookup';

/**
 * EP-3.7 transfer feature mounted on the real EP-1 core: transfer-detection
 * projection and the merge command, which reuses the real `RecordTransaction`/
 * `VoidPendingTransaction` through the {@link CommandBus}. The candidate store is
 * a bespoke in-memory double driven by the async pump (TODO(persistence)).
 */
@Module({
  imports: [ConfigModule.forFeature(transferDetectionConfig)],
  controllers: [TransferController],
  providers: [
    TransferDetector,
    { provide: TRANSFER_DETECTION_CONFIG, useFactory: () => transferDetectionConfig() },
    { provide: TransferCandidateStore, useClass: InMemoryTransferCandidateStore },
    { provide: AccountLookup, useClass: ReadModelAccountLookup },
    TransferCandidatesProjector,
    MergePendingTransfersHandler,
    ListTransferCandidatesHandler,
  ],
})
export class TransactionsModule {}
