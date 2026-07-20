export const MovementSaved = 'movement.saved';

export interface MovementSavedPayload {
  categoryId: number;
  accountId: number;
  date: Date;
  amount: number;
  user: number;
  /**
   * Crosses the outbox boundary (request → cron relay) so the trace id survives
   * the async jump and reappears in the event-handler logs (AC-4, sm-0004).
   * Optional for backward compatibility and non-request contexts (crons).
   */
  correlationId?: string;
}
