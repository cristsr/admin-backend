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
  Scheduleds,
  Status,
} from '@admin-back/grpc';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryEntity } from 'app/category/entities';
import { Repository } from 'typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { ScheduledEntity } from 'app/scheduled/entities';
import { AccountEntity } from 'app/account/entities';

@GrpcService('finances')
export class ScheduledService implements ScheduledGrpc {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>,

    @InjectRepository(ScheduledEntity)
    private scheduledRepository: Repository<ScheduledEntity>,

    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>
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
  findAll(filter: ScheduledFilter): Observable<Scheduleds> {
    const query = this.scheduledRepository.find({
      where: {
        account: { id: filter.account },
      },
      relations: ['category', 'subcategory'],
    });

    return from(query).pipe(map((data) => ({ data })));
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
      )
    );
  }

  @GrpcMethod()
  remove(scheduledId: Id): Observable<Status> {
    return from(this.scheduledRepository.delete(scheduledId)).pipe(
      map((res) => ({ status: !!res.affected }))
    );
  }
}
