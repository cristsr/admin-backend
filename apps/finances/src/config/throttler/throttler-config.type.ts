import { ThrottlerOptions } from '@nestjs/throttler';

/** Object-form throttler config (has `throttlers`, unlike the array form). */
export interface ThrottlerConfig {
  readonly throttlers: ThrottlerOptions[];
  readonly errorMessage: string;
}
