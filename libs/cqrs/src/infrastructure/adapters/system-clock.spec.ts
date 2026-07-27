import { runClockContract } from '@cqrs/testing';
import { SystemClock } from './system-clock';

runClockContract(() => new SystemClock());
