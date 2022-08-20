import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledEntity } from 'app/scheduled/entities';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import {
  CreateScheduled,
  Scheduled,
  Scheduleds,
  Status,
  UpdateScheduled,
} from '@admin-back/grpc';

@Injectable()
export class ScheduledHandler {
  #logger = new Logger(ScheduledHandler.name);

  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>,

    @InjectRepository(ScheduledEntity)
    private scheduledRepository: Repository<ScheduledEntity>
  ) {}

  findOne(id: number): Promise<Scheduled> {
    this.#logger.debug(`Find one scheduled ${id}`);

    return this.scheduledRepository.findOneByOrFail({ id }).catch(() => {
      const msg = `Scheduled ${id} not found`;
      this.#logger.error(msg);
      throw new NotFoundException(msg);
    });
  }

  findAll(): Promise<Scheduleds> {
    this.#logger.debug('Find all scheduled');
    return this.scheduledRepository
      .find({
        relations: ['category', 'subcategory'],
      })
      .then((data) => ({ data }));
  }

  async create(data: CreateScheduled): Promise<Scheduled> {
    this.#logger.debug(`Creating scheduled ${data.description}`);

    const category = await this.categoryRepository
      .findOneByOrFail({ id: data.category })
      .catch(() => {
        const msg = `Category ${data.category} not found`;
        this.#logger.error(msg);
        throw new NotFoundException(msg);
      });

    const subcategory = await this.subcategoryRepository
      .findOneByOrFail({ id: data.subcategory })
      .catch(() => {
        const msg = `Subcategory ${data.subcategory} not found`;
        this.#logger.error(msg);
        throw new NotFoundException(msg);
      });

    const scheduled = await this.scheduledRepository.save({
      ...data,
      category,
      subcategory,
    });

    this.#logger.log(`Scheduled ${scheduled.description} created`);

    return scheduled;
  }

  update(data: UpdateScheduled): Promise<Scheduled> {
    this.#logger.debug(`Updating scheduled ${data.id}`);

    return this.scheduledRepository.save({
      ...data,
      category: {
        id: data.category,
      },
      subcategory: {
        id: data.subcategory,
      },
    });
  }

  remove(id: number): Promise<Status> {
    this.#logger.log(`Removing scheduled ${id}`);
    return this.scheduledRepository
      .delete(id)
      .then((res) => ({ status: !!res.affected }));
  }
}
