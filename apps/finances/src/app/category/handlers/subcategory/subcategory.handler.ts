import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubcategoryEntity } from 'app/category/entities';
import {
  CreateSubcategories,
  CreateSubcategory,
  Status,
  Subcategories,
  Subcategory,
  UpdateSubcategory,
} from '@admin-back/grpc';
import { from, map, Observable } from 'rxjs';

@Injectable()
export class SubcategoryHandler {
  constructor(
    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  create(subcategory: CreateSubcategory): Observable<Subcategory> {
    const query = this.subcategoryRepository.save({
      ...subcategory,
      category: {
        id: subcategory.category,
      },
    });

    return from(query);
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
    const query = this.subcategoryRepository.findOne({
      where: {
        id: subcategory,
      },
    });

    return from(query);
  }

  update(data: UpdateSubcategory): Observable<Subcategory> {
    const query = this.subcategoryRepository.save(data);
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
