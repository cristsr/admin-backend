import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledServices } from './scheduled.services';
import { ScheduledHandler } from '../handlers/scheduled.handler';

describe('ScheduledController', () => {
  let controller: ScheduledServices;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduledServices],
      providers: [ScheduledHandler],
    }).compile();

    controller = module.get<ScheduledServices>(ScheduledServices);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
