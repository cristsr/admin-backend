import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { ExchangeEntity } from 'app/modules/exchange/entities';

@Injectable()
export class ExchangeRepository extends EntityRepository(ExchangeEntity) {}
