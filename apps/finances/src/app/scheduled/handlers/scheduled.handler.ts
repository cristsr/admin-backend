import { Injectable, NotFoundException } from '@nestjs/common';
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
import { AccountEntity } from 'app/account/entities';

@Injectable()
export class ScheduledHandler {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>,

    @InjectRepository(ScheduledEntity)
    private scheduledRepository: Repository<ScheduledEntity>,

    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>
  ) {}

  findOne(id: number): Promise<Scheduled> {
    return this.scheduledRepository.findOneBy({ id });
  }

  findAll(): Promise<Scheduleds> {
    return this.scheduledRepository.find().then((data) => ({ data }));
  }

  async create(data: CreateScheduled): Promise<Scheduled> {
    const category = await this.categoryRepository.findOne({
      where: {
        id: data.category,
      },
    });

    if (!category) {
      const msg = `Category ${data.category} not found`;
      throw new NotFoundException(msg);
    }

    const subcategory = await this.subcategoryRepository.findOne({
      where: {
        id: data.subcategory,
      },
    });

    if (!subcategory) {
      const msg = `Subcategory ${data.subcategory} not found`;
      throw new NotFoundException(msg);
    }

    const account = await this.accountRepository.findOne({
      where: {
        id: data.account,
      },
    });

    if (!account) {
      const msg = `Account ${data.subcategory} not found`;
      throw new NotFoundException(msg);
    }

    return await this.scheduledRepository.save({
      ...data,
      account,
      category,
      subcategory,
    });
  }

  async update(data: UpdateScheduled): Promise<Scheduled> {
    const scheduled = await this.scheduledRepository.findOne({
      where: {
        id: data.id,
      },
    });

    if (!scheduled) {
      throw new NotFoundException('Scheduled not found');
    }

    const category = await this.categoryRepository.findOne({
      where: {
        id: data.category,
      },
    });

    if (!category) {
      const msg = `Category ${data.category} not found`;
      throw new NotFoundException(msg);
    }

    const subcategory = await this.subcategoryRepository.findOne({
      where: {
        id: data.subcategory,
      },
    });

    if (!subcategory) {
      const msg = `Subcategory ${data.subcategory} not found`;
      throw new NotFoundException(msg);
    }

    const account = await this.accountRepository.findOne({
      where: {
        id: data.account,
      },
    });

    if (!account) {
      const msg = `Account ${data.subcategory} not found`;
      throw new NotFoundException(msg);
    }

    return this.scheduledRepository.save({
      ...scheduled,
      ...data,
      category,
      subcategory,
      account,
    });
  }

  remove(id: number): Promise<Status> {
    return this.scheduledRepository
      .delete(id)
      .then((res) => ({ status: !!res.affected }));
  }
}
