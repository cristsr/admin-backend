import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { MovementEntity } from 'app/movement/entities';

@Injectable()
export class MovementRepository extends EntityRepository(MovementEntity) {}
