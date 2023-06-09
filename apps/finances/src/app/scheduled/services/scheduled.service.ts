import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import {
  defer,
  forkJoin,
  from,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  ScheduledInput,
  Id,
  Scheduled,
  ScheduledFilter,
  ScheduledGrpc,
  Status,
} from '@admin-back/grpc';
import { NotFoundException } from '@nestjs/common';
import { AccountRepository } from 'app/account/repositories';
import { CategoryRepository } from 'app/category/repositories';
import { SubcategoryRepository } from 'app/subcategory/repositories';
import { ScheduledRepository } from 'app/scheduled/repositories';

@GrpcService('finances')
export class ScheduledService implements ScheduledGrpc {
  constructor(
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private scheduledRepository: ScheduledRepository,
    private accountRepository: AccountRepository
  ) {}

  @GrpcMethod()
  findOne(scheduledId: Id): Observable<Scheduled> {
    return from(
      this.scheduledRepository.findOne({
        where: scheduledId,
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  findAll(filter: ScheduledFilter): Observable<Scheduled[]> {
    return defer(() =>
      this.scheduledRepository.find({
        where: {
          account: { id: filter.account },
        },
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  save(data: ScheduledInput): Observable<Scheduled> {
    const scheduled = defer(() =>
      this.scheduledRepository.findOne({
        where: {
          id: data.id,
        },
      })
    );

    const category = defer(() =>
      this.categoryRepository.findOne({
        where: {
          id: data.category,
        },
      })
    );

    const subcategory = defer(() =>
      this.subcategoryRepository.findOne({
        where: {
          id: data.subcategory,
        },
      })
    );

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.account,
        },
      })
    );

    const source$ = forkJoin({
      scheduled: data.id ? scheduled : of(null),
      category,
      subcategory,
      account,
    });

    return source$.pipe(
      tap((e) => {
        if (data.id && !e.scheduled) {
          throw new NotFoundException(`Scheduled not found`);
        }

        if (!e.category) {
          throw new NotFoundException(`Category not found`);
        }

        if (!e.subcategory) {
          throw new NotFoundException(`Subcategory not found`);
        }

        if (!e.account) {
          throw new NotFoundException(`Account not found`);
        }
      }),
      switchMap((e) =>
        this.scheduledRepository.save({
          ...data,
          account: e.account,
          category: e.category,
          subcategory: e.subcategory,
        })
      ),
      map((v) => new Scheduled(v))
    );
  }

  @GrpcMethod()
  remove(scheduledId: Id): Observable<Status> {
    return from(this.scheduledRepository.delete(scheduledId)).pipe(
      map((res) => ({ status: !!res.affected }))
    );
  }
}
