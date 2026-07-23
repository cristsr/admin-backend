/**
 * Response DTO for ledger settings.
 */
export class LedgerSettingsOutputDto {
  constructor(
    readonly userId: string,
    readonly presentationCurrency: string,
    readonly timezone: string,
    readonly updatedAt: Date,
  ) {}
}
