import { Scheduled } from '@core';
import { Column, Entity } from 'typeorm';
import { MovementEntity } from 'app/modules/movement/entities';

@Entity('scheduled')
export class ScheduledEntity extends MovementEntity implements Scheduled {
  @Column({ nullable: true })
  repeat: boolean;
}
