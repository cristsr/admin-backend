import { Controller } from '@nestjs/common';

/**
 * Root controller kept for module wiring only. Health endpoints live in the
 * `HealthController` (AC-2, sm-0004); the old `GET /health` was removed because
 * it unintentionally sat behind the global JWT guard.
 */
@Controller()
export class AppController {}
