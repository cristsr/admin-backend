import { ConfigType, registerAs } from '@nestjs/config';
import { TransferDetectionConfig } from '@ledger/transactions/domain/services/transfer-detector.service';

/**
 * Namespaced detection settings (roadmap default: `windowDays=3`,
 * `amountTolerance=0`). Kept in a `registerAs` namespace so the window can be
 * calibrated with real data without touching the domain (open question #4).
 */
export const transferDetectionConfig = registerAs(
  'transferDetection',
  (): TransferDetectionConfig => ({
    windowDays: Number(process.env.TRANSFER_WINDOW_DAYS ?? 3),
    amountTolerance: process.env.TRANSFER_AMOUNT_TOLERANCE ?? '0',
  }),
);

export type TransferDetectionConfigType = ConfigType<typeof transferDetectionConfig>;
