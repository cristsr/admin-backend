import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransformDate } from '../functions';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  @TransformDate()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  @TransformDate()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  @TransformDate()
  deletedAt: Date;
}
