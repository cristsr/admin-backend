import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';

@Controller()
export class AppController {
  readonly #logger = new Logger(AppController.name);

  @Get()
  @HttpCode(HttpStatus.ACCEPTED)
  health() {
    this.#logger.log('Health check success');
  }
}
