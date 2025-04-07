import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from '../services/app.service';
import { ExchangeController } from './exchange.controller';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [ExchangeController],
      providers: [AppService],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      const appController = app.get<ExchangeController>(ExchangeController);
      expect(
        appController.rate({
          rate: 0,
          from: '',
          to: '',
          date: new Date(),
        }),
      ).toEqual({ message: 'Hello API' });
    });
  });
});
