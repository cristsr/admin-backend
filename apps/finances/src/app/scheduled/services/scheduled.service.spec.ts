import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledService } from './scheduled.service';

describe('ScheduledService', () => {
  let controller: ScheduledService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduledService],
      providers: [],
    }).compile();

    controller = module.get<ScheduledService>(ScheduledService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
