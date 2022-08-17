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

@Injectable()
export class SubcategoryHandler {
  constructor(
    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  create(subcategory: CreateSubcategory) {
    return this.subcategoryRepository.save({
      ...subcategory,
      category: {
        id: subcategory.category,
      },
    });
  }

  async createMany(data: CreateSubcategories): Promise<Status> {
    const records = data.data.map((subcategory) => ({
      ...subcategory,
      category: {
        id: data.category,
      },
    }));

    await this.subcategoryRepository.insert(records);

    return {
      status: true,
    };
  }

  findAll(category: number): Promise<Subcategories> {
    return this.subcategoryRepository
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
  }

  findOne(subcategory: number) {
    return this.subcategoryRepository.findOne({
      where: {
        id: subcategory,
      },
    });
  }

  update(data: UpdateSubcategory): Promise<Subcategory> {
    return this.subcategoryRepository.save(data);
  }

  remove(subcategory: number) {
    return this.subcategoryRepository
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
  }
}
