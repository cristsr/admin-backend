import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { forkJoin, from, map, Observable, switchMap } from 'rxjs';
import { ScheduledHandler } from 'app/scheduled/handlers';
import {
  CreateScheduled,
  Id,
  Scheduled,
  ScheduledFilter,
  ScheduledGrpc,
  Scheduleds,
  Status,
  UpdateScheduled,
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
    private accountRepository: Repository<AccountEntity>,

    private scheduledService: ScheduledHandler
  ) {}

  @GrpcMethod()
  findOne(scheduledId: Id): Observable<Scheduled> {
    return from(this.scheduledRepository.findOneBy(scheduledId));
  }

  @GrpcMethod()
  findAll(filters: ScheduledFilter): Observable<Scheduleds> {
    const query = this.scheduledRepository.find({
      where: {
        account: { id: filters.account },
      },
    });

    return from(query).pipe(map((data) => ({ data })));
  }

  @GrpcMethod()
  create(data: CreateScheduled): Observable<Scheduled> {
    const category = this.categoryRepository
      .findOneOrFail({
        where: {
          id: data.category,
        },
      })
      .catch(() => {
        throw new NotFoundException(`Category not found`);
      });

    const subcategory = this.subcategoryRepository
      .findOneOrFail({
        where: {
          id: data.subcategory,
        },
      })
      .catch(() => {
        throw new NotFoundException(`Subcategory not found`);
      });

    const account = this.accountRepository
      .findOneOrFail({
        where: {
          id: data.account,
        },
      })
      .catch(() => {
        throw new NotFoundException(`Account not found`);
      });

    const source$ = forkJoin({
      category,
      subcategory,
      account,
    });

    return source$.pipe(
      switchMap((entities) => {
        return this.scheduledRepository.save({
          ...data,
          account: entities.account,
          category: entities.category,
          subcategory: entities.subcategory,
        });
      })
    );
  }

  @GrpcMethod()
  update(scheduled: UpdateScheduled): Observable<Scheduled> {
    return from(this.scheduledService.update(scheduled));
  }

  @GrpcMethod()
  remove(scheduledId: Id): Observable<Status> {
    return from(this.scheduledRepository.delete(scheduledId)).pipe(
      map((res) => ({ status: !!res.affected }))
    );
  }
}
