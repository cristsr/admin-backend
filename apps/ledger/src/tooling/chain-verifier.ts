import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { canonicalJson, sha256Hex } from '@shared';
import { ChainBreak, ChainVerificationReport } from './chain-verification-report.type';

const DEFAULT_PAGE_SIZE = 1000;
const GENESIS_HASH = '';

/**
 * Recomputes each event's hash from its own chain input and compares it
 * against the persisted one (AC-4). Never stops at the first break: it walks
 * the full chain and reports every discrepancy, chaining forward with the
 * recomputed hash — not the persisted one — as the next `prevHash`. A row
 * whose stored `hash` was corrupted still had its true chain hash written
 * correctly into the next row's own hash by the original `append`; trusting
 * the recomputed value instead of the tampered one is what keeps a single
 * altered row from cascading into a false break on every row after it.
 * Read-only: never calls anything that writes to the event store.
 */
export class ChainVerifier {
  constructor(
    private readonly reader: EventChainReader,
    private readonly pageSize: number = DEFAULT_PAGE_SIZE,
  ) {}

  async verifyChain(userId?: string): Promise<ChainVerificationReport> {
    const userIds = userId ? [userId] : await this.reader.userIds();

    let eventsChecked = 0;
    const breaks: ChainBreak[] = [];

    for (const id of userIds) {
      const result = await this.verifyUser(id);
      eventsChecked += result.eventsChecked;
      breaks.push(...result.breaks);
    }

    return {
      ok: breaks.length === 0,
      usersChecked: userIds.length,
      eventsChecked,
      breaks,
    };
  }

  private async verifyUser(userId: string): Promise<{ eventsChecked: number; breaks: ChainBreak[] }> {
    let prevHash = GENESIS_HASH;
    let position = 0n;
    let eventsChecked = 0;
    const breaks: ChainBreak[] = [];

    for (;;) {
      const page = await this.reader.readChain(userId, position, this.pageSize);
      if (!page.length) break;

      for (const row of page) {
        const expected = sha256Hex(prevHash + (await canonicalJson(row.chainInput)));

        if (expected !== row.hash) {
          breaks.push({
            userId,
            globalPosition: row.globalPosition,
            eventId: row.eventId,
            expectedHash: expected,
            actualHash: row.hash,
          });
        }

        // Chain forward with the recomputed value, not the persisted one —
        // one tampered row must not cascade into every row after it.
        prevHash = expected;
        eventsChecked += 1;
      }

      position = page[page.length - 1].globalPosition;
    }

    return { eventsChecked, breaks };
  }
}
