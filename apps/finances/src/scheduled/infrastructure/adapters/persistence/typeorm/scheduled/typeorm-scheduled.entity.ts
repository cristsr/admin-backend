import { Column, Entity } from 'typeorm';
import { TypeOrmMovementEntity } from '../../../../../../movement/infrastructure/adapters/persistence/typeorm/movement';

@Entity('scheduled')
export class TypeOrmScheduledEntity extends TypeOrmMovementEntity {
  @Column({ nullable: true })
  repeat: boolean;
}
