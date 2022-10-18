import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { from, map, Observable, switchMap } from 'rxjs';
import {
  SubcategoryGrpc,
  CreateSubcategory,
  CreateSubcategories,
  Status,
  Subcategory,
  UpdateSubcategory,
  Subcategories,
  Id,
} from '@admin-back/grpc';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryEntity } from 'app/category/entities';
import { Repository } from 'typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { NotFoundException } from '@nestjs/common';

@GrpcService('finances')
export class SubcategoryService implements SubcategoryGrpc {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  @GrpcMethod()
  findOne(subcategoryId: Id): Observable<Subcategory> {
    const query = this.subcategoryRepository.findOne({
      where: subcategoryId,
    });

    return from(query);
  }

  @GrpcMethod()
  findByCategory(categoryId: Id): Observable<Subcategories> {
    const query$ = this.subcategoryRepository.find({
      where: {
        category: categoryId,
      },
    });

    return from(query$).pipe(map((data) => ({ data })));
  }

  @GrpcMethod()
  create(data: CreateSubcategory): Observable<Subcategory> {
    const category$ = this.categoryRepository
      .findOneOrFail({
        where: {
          id: data.category,
        },
      })
      .catch(() => {
        throw new NotFoundException('Category not found');
      });

    return from(category$).pipe(
      switchMap((category) => {
        return this.subcategoryRepository.save({
          ...data,
          category,
        });
      })
    );
  }

  @GrpcMethod()
  createMany(data: CreateSubcategories): Observable<Status> {
    const records = data.data.map((subcategory) => ({
      ...subcategory,
      category: { id: data.category },
    }));

    const query$ = this.subcategoryRepository.insert(records);

    return from(query$).pipe(map(() => ({ status: true })));
  }

  @GrpcMethod()
  update(data: UpdateSubcategory): Observable<Subcategory> {
    const query$ = this.subcategoryRepository.save({
      ...data,
      category: { id: data.category },
    });

    return from(query$);
  }

  @GrpcMethod()
  remove(subcategoryId: Id): Observable<Status> {
    const query$ = this.subcategoryRepository
      .delete(subcategoryId)
      .then((res) => {
        if (res.affected) {
          return {
            status: true,
          };
        }

        return {
          status: false,
        };
      });

    return from(query$);
  }
}
