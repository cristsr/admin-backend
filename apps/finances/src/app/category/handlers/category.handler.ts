import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSubcategoryDto, UpdateSubcategoryDto } from 'app/category/dto';
import { CategoryEntity, SubcategoryEntity } from 'app/category/entities';
import {
  Categories,
  Category,
  CreateCategory,
  Status,
  UpdateCategory,
} from '@admin-back/grpc';

@Injectable()
export class CategoryHandler {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  async create({ name, color, icon, subcategories }: CreateCategory) {
    const category = await this.categoryRepository
      .save({ name, icon, color })
      .catch((err) => {
        throw new InternalServerErrorException(err);
      });

    if (!subcategories?.length) {
      return category;
    }

    category.subcategories = await this.subcategoryRepository
      .save(
        subcategories.map((v) => {
          return this.subcategoryRepository.create({ ...v, category });
        })
      )
      .catch((err) => {
        throw new InternalServerErrorException(err);
      });

    return category;
  }

  async createMany(categoriesDto: CreateCategory[]): Promise<Status> {
    try {
      for (const category of categoriesDto) {
        await this.create(category);
      }
      return {
        status: true,
      };
    } catch (e) {
      return {
        status: false,
      };
    }
  }

  async findAll(): Promise<Categories> {
    const categories = await this.categoryRepository.find({
      relations: ['subcategories'],
    });

    return {
      data: categories,
    };
  }

  findOne(id: number): Promise<Category> {
    return this.categoryRepository
      .findOneOrFail({
        relations: ['subcategories'],
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('Category not found');
      });
  }

  update(data: UpdateCategory): Promise<Category> {
    if (!this.categoryRepository.findOneByOrFail({ id: data.id })) {
      throw new NotFoundException('Category not found');
    }

    return this.categoryRepository.save(data);
  }

  remove(id: number): Promise<Status> {
    return this.categoryRepository.delete(id).then((result) => ({
      status: !!result.affected,
    }));
  }

  async removeAll(): Promise<Status> {
    try {
      await this.categoryRepository.delete({});
      return {
        status: true,
      };
    } catch (e) {
      return {
        status: false,
      };
    }
  }

  async createSubcategory(category: number, subcategory: CreateSubcategoryDto) {
    return this.subcategoryRepository.save({
      ...subcategory,
      category: { id: category },
    });
  }

  async createSubcategories(
    category: number,
    subcategories: CreateSubcategoryDto[]
  ) {
    await this.subcategoryRepository.insert(
      subcategories.map((v) => ({
        ...v,
        category: { id: category },
      }))
    );
  }

  findSubcategories(category: number) {
    return this.subcategoryRepository.find({
      where: { category: { id: category } },
    });
  }

  findSubcategory(category: number, subcategory: number) {
    return this.subcategoryRepository.findOne({
      where: { category: { id: category }, id: subcategory },
    });
  }

  updateSubcategory(
    category: number,
    subcategory: number,
    updateSubcategoryDto: UpdateSubcategoryDto
  ) {
    return this.subcategoryRepository.update(
      { category: { id: category }, id: subcategory },
      updateSubcategoryDto
    );
  }

  removeSubcategory(category: number, subcategory: number) {
    return this.subcategoryRepository.delete({
      category: { id: category },
      id: subcategory,
    });
  }
}
