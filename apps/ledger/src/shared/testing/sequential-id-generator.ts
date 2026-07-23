import { IdGenerator } from '@ledger/shared/domain/ports';

/** Deterministic double: monotonic, reproducible ids like '00000000-0000-4000-8000-000000000001'. */
export class SequentialIdGenerator extends IdGenerator {
  private sequence = 0;

  next(): string {
    this.sequence += 1;

    return `00000000-0000-4000-8000-${this.sequence.toString(16).padStart(12, '0')}`;
  }
}
