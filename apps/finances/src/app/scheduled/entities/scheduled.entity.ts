import { Column, Entity } from 'typeorm';
import { Scheduled } from '@admin-back/grpc';
import { MovementEntity } from 'app/movement/entities';

@Entity('scheduled')
export class ScheduledEntity extends MovementEntity implements Scheduled {
  @Column({ nullable: true })
  repeat: boolean;
}
