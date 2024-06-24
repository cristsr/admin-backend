import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { ExchangeEntity } from 'app/entities';

@Injectable()
export class ExchangeRepository extends EntityRepository(ExchangeEntity) {}
