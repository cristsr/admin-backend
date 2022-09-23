import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledService } from './scheduled.service';
import { ScheduledHandler } from '../handlers/scheduled.handler';

describe('ScheduledService', () => {
  let controller: ScheduledService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduledService],
      providers: [ScheduledHandler],
    }).compile();

    controller = module.get<ScheduledService>(ScheduledService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
