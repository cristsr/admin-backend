import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';
import { ExchangeEntity } from 'app/entities';

@Injectable()
export class ExchangeRepository extends EntityRepository(ExchangeEntity) {}
