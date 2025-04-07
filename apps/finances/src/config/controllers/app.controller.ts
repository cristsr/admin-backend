import { Controller, Get, Logger } from '@nestjs/common';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  @Get('health')
  health() {
    this.logger.log('Health check success');
    return { status: 'ok' };
  }
}
