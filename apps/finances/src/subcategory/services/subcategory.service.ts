import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Id,
  Status,
  SubcategoriesInput,
  Subcategory,
  SubcategoryHandler,
  SubcategoryInput,
} from '@core';
import { Observable, defer, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { CategoryRepository } from 'app/category/repositories';
import { SubcategoryRepository } from 'app/subcategory/repositories';

@Injectable()
export class SubcategoryService implements SubcategoryHandler {
  constructor(
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository
  ) {}

  findOne(subcategoryId: Id): Observable<Subcategory> {
    return defer(() => this.subcategoryRepository.findOneBy(subcategoryId));
  }

  findByCategory(categoryId: Id): Observable<Subcategory[]> {
    return defer(() => {
      return this.subcategoryRepository.find({
        where: {
          category: categoryId,
        },
      });
    });
  }

  save(data: SubcategoryInput): Observable<Subcategory> {
    const subcategory = defer(() =>
      this.subcategoryRepository.findOne({
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

    const source$ = forkJoin({
      subcategory: data.id ? subcategory : of(null),
      category,
    });

    return source$.pipe(
      tap((e) => {
        if (data.id && !e.subcategory) {
          throw new NotFoundException('Subcategory not found');
        }

        if (!e.category) {
          throw new NotFoundException('Category not found');
        }
      }),
      switchMap((e) =>
        this.subcategoryRepository.save({
          ...e.subcategory,
          name: data.name,
          category: e.category,
        })
      )
    );
  }

  saveMany(data: SubcategoriesInput): Observable<Status> {
    const records = data.data.map((subcategory) => ({
      ...subcategory,
      category: { id: data.category },
    }));

    return defer(() => this.subcategoryRepository.insert(records)).pipe(
      map(() => ({ status: true }))
    );
  }

  remove(subcategoryId: Id): Observable<Status> {
    return defer(() => this.subcategoryRepository.delete(subcategoryId)).pipe(
      map((res) => {
        if (res.affected) {
          return {
            status: true,
          };
        }

        return {
          status: false,
        };
      })
    );
  }
}
