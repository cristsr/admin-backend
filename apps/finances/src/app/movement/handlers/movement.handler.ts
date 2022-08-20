import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Raw, Repository } from 'typeorm';
import { DateTime, Interval } from 'luxon';
import { MovementEntity } from 'app/movement/entities';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import {
  CreateMovement,
  Movement,
  MovementFilter,
  Movements,
  Status,
  UpdateMovement,
} from '@admin-back/grpc';

@Injectable()
export class MovementHandler {
  readonly #logger = new Logger(MovementHandler.name);

  constructor(
    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>,

    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  /**
   * It creates a movement
   * @param {CreateMovement} data - CreateMovementDto
   * @returns MovementEntity
   */
  async create(data: CreateMovement): Promise<Movement> {
    const category = await this.categoryRepository.findOneBy({
      id: data.category,
    });

    if (!category) {
      const msg = `Category ${data.category} not found`;
      this.#logger.log(msg);
      throw new NotFoundException(msg);
    }

    const subcategory = await this.subcategoryRepository.findOne({
      where: {
        id: data.subcategory,
        category,
      },
    });

    if (!subcategory) {
      const msg = `Subcategory ${data.subcategory} not found`;
      this.#logger.log(msg);
      throw new NotFoundException(msg);
    }

    const movement = await this.movementRepository.save({
      ...data,
      category,
      subcategory,
    });

    this.#logger.log(`Movement ${movement.id} created`);

    return movement;
  }

  /**
   * It finds all movements that match the given query parameters
   * @param {MovementFilter} filters - MovementQueryDto
   * @returns An array of MovementDto objects
   */
  async findAll(filters: MovementFilter): Promise<Movements> {
    // Where conditions
    const where: any = {};

    // Setup where conditions
    if (filters.period === 'day') {
      where.date = DateTime.fromISO(filters.date).toSQLDate();
    }

    if (filters.period === 'week') {
      const interval = Interval.fromISO(filters.date);
      where.date = Between(
        interval.start.toSQLDate(),
        interval.end.toSQLDate()
      );
    }

    if (filters.period === 'month') {
      const date = DateTime.fromISO(filters.date).toFormat('yyyy-MM');
      where.date = Raw((alias) => `to_char(${alias}, 'YYYY-MM') = :date`, {
        date,
      });
    }

    if (filters.period === 'year') {
      const date = DateTime.fromISO(filters.date).toFormat('yyyy');
      where.date = Raw((alias) => `to_char(${alias}, 'YYYY') = :date`, {
        date,
      });
    }

    if (filters.category) {
      where.category = await this.categoryRepository
        .findOneByOrFail({ id: filters.category })
        .catch(() => {
          const msg = `Category ${filters.category} not found`;
          this.#logger.log(msg);
          throw new NotFoundException(msg);
        });
    }

    if (filters.type?.length) {
      where.type = In(filters.type);
    }

    // Execute query
    return await this.movementRepository
      .find({
        relations: ['category', 'subcategory'],
        where,
        order: { date: 'DESC', createdAt: 'DESC' },
      })
      .then((data) => ({ data }));
  }

  /**
   * It finds a movement by id, and if it doesn't find it, it throws a NotFoundException
   * @param {number} id - number - the id of the movement we want to find
   * @returns A promise of a MovementEntity
   */
  findOne(id: number): Promise<MovementEntity> {
    return this.movementRepository
      .findOneOrFail({
        relations: ['category', 'subcategory'],
        where: { id },
      })
      .catch(() => {
        const msg = `Movement ${id} not found`;
        this.#logger.log(msg);
        throw new NotFoundException(msg);
      });
  }

  /**
   * It updates a movement entity with the given data, and returns the updated entity
   * @param {UpdateMovement} data - UpdateMovementDto
   * @returns The updated movement entity
   */
  async update(data: UpdateMovement): Promise<Movement> {
    const partialEntity: any = { ...data };

    if (data.category) {
      partialEntity.category = await this.categoryRepository
        .findOneByOrFail({ id: data.category })
        .catch(() => {
          const msg = `Category ${data.category} not found`;
          this.#logger.log(msg);
          throw new NotFoundException(msg);
        });
    }

    if (data.subcategory) {
      partialEntity.subcategory = await this.subcategoryRepository
        .findOneByOrFail({ id: data.subcategory })
        .catch(() => {
          const msg = `Subcategory ${data.subcategory} not found`;
          this.#logger.log(msg);
          throw new NotFoundException(msg);
        });
    }

    const movementEntity = await this.movementRepository
      .save(partialEntity)
      .catch((e) => {
        this.#logger.log(`Error updating movement: ${e.message}`);
        throw new InternalServerErrorException(e.message);
      });

    this.#logger.log(`Movement ${movementEntity.id} updated`);

    return movementEntity;
  }

  /**
   * It deletes a movement from the database
   * @param {number} id - number - The id of the movement to delete
   * @returns A promise that resolves to an object with a message property.
   */
  async remove(id: number): Promise<Status> {
    const result = await this.movementRepository.delete(id).catch((e) => {
      this.#logger.log(`Error deleting movement: ${e.message}`);
      throw new InternalServerErrorException(e.message);
    });

    if (!result.affected) {
      const msg = `Movement ${id} not found`;
      this.#logger.debug(msg);

      return {
        status: false,
      };
    }

    this.#logger.log(`Movement ${id} deleted`);

    return {
      status: true,
    };
  }

  async removeAll(): Promise<Status> {
    await this.movementRepository.clear().catch((e) => {
      throw new InternalServerErrorException(e.message);
    });

    return {
      status: true,
    };
  }
}
