import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdGenerator } from '@ledger/shared/domain/ports';

/** Real adapter: RFC 4122 v4 ids from the platform CSPRNG. */
@Injectable()
export class UuidIdGenerator extends IdGenerator {
  next(): string {
    return randomUUID();
  }
}
