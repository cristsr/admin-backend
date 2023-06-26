import { NotFoundException } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { defer, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { Between, DeleteResult, In } from 'typeorm';
import {
  MovementInput,
  Id,
  Movement,
  MovementFilter,
  MovementGrpc,
  Status,
} from '@admin-back/grpc';
import { AccountRepository } from 'app/account/repositories';
import { MovementRepository } from 'app/movement/repositories';
import { CategoryRepository } from 'app/category/repositories';
import { SubcategoryRepository } from 'app/subcategory/repositories';

@GrpcService('finances')
export class MovementService implements MovementGrpc {
  constructor(
    private movementRepository: MovementRepository,
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private accountRepository: AccountRepository
  ) {}

  @GrpcMethod()
  findAll(filter: MovementFilter): Observable<Movement[]> {
    return defer(() =>
      this.movementRepository.find({
        where: {
          date: Between(filter.startDate, filter.endDate),
          category: { id: filter.category },
          account: { id: filter.account },
          type: filter.type?.length ? In(filter.type) : null,
        },
        order: {
          date: 'DESC',
          createdAt: 'DESC',
        },
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  findOne(movementId: Id): Observable<Movement> {
    return defer(() =>
      this.movementRepository.findOne({
        where: movementId,
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  save(data: MovementInput): Observable<Movement> {
    console.log('data', data);
    const movement = defer(() =>
      this.movementRepository.findOne({
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
          category: {
            id: data.category,
          },
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

    // Do search in parallel
    const source$ = forkJoin({
      movement: data.id ? movement : of(null),
      category,
      subcategory,
      account,
    });

    return source$.pipe(
      tap((e) => {
        if (data.id && !e.movement) {
          throw new NotFoundException(`Movement not found`);
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
        this.movementRepository.save({
          ...e.movement,
          ...data,
          category: e.category,
          subcategory: e.subcategory,
          account: e.account,
        })
      ),
      map((m) => new Movement(m))
    );
  }

  @GrpcMethod()
  remove(movement: Id): Observable<Status> {
    return defer(() => this.movementRepository.delete(movement.id)).pipe(
      map((data: DeleteResult) => ({
        status: !!data.affected,
      }))
    );
  }

  @GrpcMethod()
  removeAll() {
    return defer(() => this.movementRepository.clear()).pipe(
      map(() => ({
        status: true,
      }))
    );
  }
}
