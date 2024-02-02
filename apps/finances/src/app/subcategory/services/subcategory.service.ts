import { NotFoundException } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { Observable, defer, forkJoin, map, of, switchMap, tap } from 'rxjs';
import {
  CreateSubcategories,
  Id,
  Status,
  Subcategory,
  SubcategoryGrpc,
  SubcategoryInput,
} from '@admin-back/grpc';
import { CategoryRepository } from 'app/category/repositories';
import { SubcategoryRepository } from 'app/subcategory/repositories';

@GrpcService('finances')
export class SubcategoryService implements SubcategoryGrpc {
  constructor(
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository
  ) {}

  @GrpcMethod()
  findOne(subcategoryId: Id): Observable<Subcategory> {
    return defer(() => this.subcategoryRepository.findOneBy(subcategoryId));
  }

  @GrpcMethod()
  findByCategory(categoryId: Id): Observable<Subcategory[]> {
    return defer(() => {
      return this.subcategoryRepository.find({
        where: {
          category: categoryId,
        },
      });
    });
  }

  @GrpcMethod()
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

  @GrpcMethod()
  saveMany(data: CreateSubcategories): Observable<Status> {
    const records = data.data.map((subcategory) => ({
      ...subcategory,
      category: { id: data.category },
    }));

    return defer(() => this.subcategoryRepository.insert(records)).pipe(
      map(() => ({ status: true }))
    );
  }

  @GrpcMethod()
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
