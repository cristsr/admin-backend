import { Test, TestingModule } from '@nestjs/testing';
import { MovementSubscriber } from './movement.subscriber';
import { DataSource, UpdateEvent } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BalanceEntity } from 'app/account/entities';
import { MovementEntity } from 'app/movement/entities';

describe('MovementSubscriber', () => {
  let service: MovementSubscriber;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementSubscriber,
        {
          provide: getRepositoryToken(BalanceEntity),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            subscribers: [],
          },
        },
      ],
    }).compile();

    service = module.get<MovementSubscriber>(MovementSubscriber);
  });

  describe('Setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('After update', () => {
    // No hay diferencias entre tmipo y cantidad entre la version anterior y la nueva
    it('no differences between type and amount of old version and new one', () => {
      const updateEvent: Partial<UpdateEvent<Partial<MovementEntity>>> = {
        entity: {
          description: 'test updated',
          amount: 60000,
          type: 'income',
          user: 1,
          account: {
            id: 1,
          },
        },
        databaseEntity: {
          description: 'test',
          amount: 60000,
          type: 'income',
          user: 1,
          account: <any>{
            id: 1,
          },
        },
      };

      service.afterUpdate(<any>updateEvent);
    });
  });
});
