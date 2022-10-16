import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { from, map, Observable } from 'rxjs';
import {
  CreateSubcategories,
  CreateSubcategory,
  Status,
  Subcategories,
  Subcategory,
  UpdateSubcategory,
} from '@admin-back/grpc';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { CategoryEntity } from 'app/category/entities';

@Injectable()
export class SubcategoryHandler {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  async create(data: CreateSubcategory): Promise<Subcategory> {
    const category = await this.categoryRepository.findOne({
      where: {
        id: data.category,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.subcategoryRepository.save({
      ...data,
      category,
    });
  }

  createMany(data: CreateSubcategories): Observable<Status> {
    const records = data.data.map((subcategory) => ({
      ...subcategory,
      category: {
        id: data.category,
      },
    }));

    const query = this.subcategoryRepository.insert(records);

    return from(query).pipe(
      map(() => ({
        status: true,
      }))
    );
  }

  findAll(category: number): Observable<Subcategories> {
    const query = this.subcategoryRepository
      .find({
        where: {
          category: {
            id: category,
          },
        },
      })
      .then((data) => ({
        data,
      }));

    return from(query);
  }

  findOne(subcategory: number): Observable<Subcategory> {
    const query = this.subcategoryRepository.findOneOrFail({
      where: {
        id: subcategory,
      },
    });

    return from(query);
  }

  update(data: UpdateSubcategory): Observable<Subcategory> {
    const query = this.subcategoryRepository.save({
      ...data,
      category: data.category && { id: data.category },
    });

    return from(query);
  }

  remove(subcategory: number): Observable<Status> {
    const query = this.subcategoryRepository
      .delete({
        id: subcategory,
      })
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

    return from(query);
  }
}
