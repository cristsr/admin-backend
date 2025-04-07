import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { MovementEntity } from 'app/modules/movement/entities';

@Injectable()
export class MovementRepository extends EntityRepository(MovementEntity) {}
