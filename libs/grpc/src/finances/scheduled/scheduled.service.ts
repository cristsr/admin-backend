import { CreateMovement, Movement } from '@admin-back/grpc';
import { Observable } from 'rxjs';
import { Empty } from '../../types';

export interface ScheduledService {
  create(data: CreateScheduled): Observable<Scheduled>;
  findOne(id: ScheduledId): Observable<Scheduled>;
  findAll(empty: Empty): Observable<Scheduled[]>;
  update(data: UpdateScheduled): Observable<Scheduled>;
  remove(id: ScheduledId): Observable<Empty>;
}

interface Scheduled extends Movement {
  recurrent: boolean;
}

interface CreateScheduled
  extends Omit<CreateMovement, 'id' | 'category' | 'subcategory'> {
  recurrent: boolean;
  category: number;
  subcategory: number;
}

interface UpdateScheduled extends Partial<CreateScheduled> {
  id: number;
}

export interface ScheduledId {
  id: number;
}
