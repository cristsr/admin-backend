import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Id,
  Movement,
  MovementFilter,
  MovementHandler,
  MovementInput,
  Status,
} from '@core';
import { Observable, defer, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { Between, In } from 'typeorm';
import { AccountRepository } from 'app/modules/account/repositories';
import { CategoryRepository } from 'app/modules/category/repositories';
import { MovementRepository } from 'app/modules/movement/repositories';
import { SubcategoryRepository } from 'app/modules/subcategory/repositories';

@Injectable()
export class MovementService implements MovementHandler {
  constructor(
    private movementRepository: MovementRepository,
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private accountRepository: AccountRepository,
  ) {}

  findAll(filter: MovementFilter): Promise<Movement[]> {
    return this.movementRepository.find({
      where: {
        date: Between(filter.startDate, filter.endDate),
        category: {
          id: filter.category,
        },
        account: {
          id: filter.account,
        },
        type: filter.type?.length ? In(filter.type) : null,
      },
      order: {
        date: 'DESC',
        createdAt: 'DESC',
      },
      relations: ['category', 'subcategory'],
    });
  }

  async findOne({ id, user }: any): Promise<Movement> {
    return this.movementRepository.findOne({
      where: {
        id,
        user,
      },
      relations: ['category', 'subcategory'],
    });
  }

  save(data: MovementInput): Observable<Movement> {
    const movement = defer(() =>
      this.movementRepository.findOne({
        where: {
          id: data.id,
        },
      }),
    );

    const category = defer(() =>
      this.categoryRepository.findOne({
        where: {
          id: data.category,
        },
      }),
    );

    const subcategory = defer(() =>
      this.subcategoryRepository.findOne({
        where: {
          id: data.subcategory,
          category: {
            id: data.category,
          },
        },
      }),
    );

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.account,
        },
      }),
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
        }),
      ),
      map((m) => new Movement(m)),
    );
  }

  async remove({ id, user }: any): Promise<Status> {
    const data = await this.movementRepository.delete({
      id,
      user,
    });

    return {
      status: !!data.affected,
    };
  }

  async removeAll(): Promise<Status> {
    await this.movementRepository.clear();
    return {
      status: true,
    };
  }
}
