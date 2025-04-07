import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoriesInput,
  Category,
  CategoryHandler,
  CategoryInput,
  Id,
  Status,
} from '@core';
import {
  Observable,
  catchError,
  defer,
  finalize,
  from,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { DataSource } from 'typeorm';
import { CategoryEntity } from 'app/modules/category/entities';
import { CategoryRepository } from 'app/modules/category/repositories';
import { SubcategoryRepository } from 'app/modules/subcategory/repositories';

@Injectable()
export class CategoryService implements CategoryHandler {
  constructor(
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private dataSource: DataSource,
  ) {}

  async findOne(categoryId: Id): Promise<Category> {
    return this.categoryRepository.findOne({ where: categoryId });
  }

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find({
      relations: ['subcategories'],
    });
  }

  save(data: CategoryInput): Observable<Category> {
    const category$ = defer(() =>
      this.categoryRepository.findOneOrFail({
        where: {
          id: data.id,
        },
        relations: ['subcategories'],
      }),
    );

    const source$ = data.id ? category$ : of(null);

    return source$.pipe(
      tap((category) => {
        if (data.id && !category) {
          throw new NotFoundException('Category not found');
        }
      }),
      switchMap((category: CategoryEntity) =>
        this.categoryRepository.save({
          ...category,
          name: data.name,
          icon: data.icon,
          color: data.color,
        }),
      ),
      switchMap((category: CategoryEntity) => {
        if (data.id) {
          return of(category);
        }

        if (!data.subcategories?.length) {
          return of(category);
        }

        // Save subcategories
        const records = data.subcategories.map((v) => ({
          ...v,
          category,
        }));

        return this.subcategoryRepository
          .save(records)
          .then((subcategories) => ({
            ...category,
            subcategories,
          }));
      }),
    );
  }

  saveMany({ data }: CategoriesInput): Observable<Status> {
    const queryRunner = this.dataSource.createQueryRunner();

    return defer(() => queryRunner.connect()).pipe(
      switchMap(() => queryRunner.startTransaction()),
      switchMap(() =>
        queryRunner.manager.save(
          data.map((v) =>
            this.categoryRepository.create({
              name: v.name,
              icon: v.icon,
              color: v.color,
            }),
          ),
        ),
      ),
      switchMap((categories) =>
        queryRunner.manager.save(
          data
            .map((d) => d.subcategories)
            .map((s, i) =>
              s.map((v) =>
                this.subcategoryRepository.create({
                  name: v.name,
                  category: categories[i],
                }),
              ),
            )
            .flat(),
        ),
      ),
      switchMap(() => queryRunner.commitTransaction()),
      map(() => ({ status: true })),
      catchError(() =>
        from(queryRunner.rollbackTransaction()).pipe(
          map(() => ({ status: false })),
        ),
      ),
      finalize(() => queryRunner.release()),
    );
  }

  async remove(category: Id): Promise<Status> {
    const result = await this.categoryRepository.delete(category.id);
    return {
      status: !!result.affected,
    };
  }

  async removeAll(): Promise<Status> {
    try {
      await this.categoryRepository.clear();
      return { status: true };
    } catch {
      return { status: false };
    }
  }
}
