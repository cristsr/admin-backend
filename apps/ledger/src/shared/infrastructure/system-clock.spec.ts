import { runClockContract } from '@ledger/shared/testing/contract/clock.contract';
import { SystemClock } from './system-clock';

runClockContract(() => new SystemClock());
