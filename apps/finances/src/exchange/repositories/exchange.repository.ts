import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { ExchangeEntity } from '../entities/exchange.entity';

@Injectable()
export class ExchangeRepository extends EntityRepository(ExchangeEntity) {}
