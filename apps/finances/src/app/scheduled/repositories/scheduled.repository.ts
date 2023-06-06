import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';
import { ScheduledEntity } from 'app/scheduled/entities';

@Injectable()
export class ScheduledRepository extends EntityRepository(ScheduledEntity) {}
