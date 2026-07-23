import { Injectable } from '@nestjs/common';
import { Clock } from '@ledger/shared/domain/ports';

/** Real adapter: the system wall clock. */
@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
