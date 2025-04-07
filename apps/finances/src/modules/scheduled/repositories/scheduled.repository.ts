import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { ScheduledEntity } from 'app/modules/scheduled/entities';

@Injectable()
export class ScheduledRepository extends EntityRepository(ScheduledEntity) {}
