import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';
import { MovementEntity } from 'app/movement/entities';

@Injectable()
export class MovementRepository extends EntityRepository(MovementEntity) {}
