import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AppService } from '../services/app.service';
import { ExchangeController } from './exchange.controller';

describe('ExchangeController', () => {
  let controller: ExchangeController;
  const appService = { rate: jest.fn() };

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ExchangeController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    controller = app.get<ExchangeController>(ExchangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates rate lookups to the service', () => {
    const input = { from: 'USD', to: 'COP', rate: 1, date: new Date() };
    appService.rate.mockReturnValue(of({ rate: 4000 }));

    controller.rate(input);

    expect(appService.rate).toHaveBeenCalledWith(input);
  });
});
