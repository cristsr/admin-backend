import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledHandler } from './scheduled.handler';

describe('ScheduledService', () => {
  let service: ScheduledHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScheduledHandler],
    }).compile();

    service = module.get<ScheduledHandler>(ScheduledHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
