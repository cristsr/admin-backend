import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movement, UpdateMovement } from '@admin-back/grpc';
import { MovementEntity } from 'app/movement/entities';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { AccountEntity } from 'app/account/entities';

@Injectable()
export class MovementHandler {
  readonly #logger = new Logger(MovementHandler.name);

  constructor(
    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>,

    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>,

    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>
  ) {}

  /**
   * It updates a movement entity with the given data, and returns the updated entity
   * @param {UpdateMovement} data - UpdateMovementDto
   * @returns The updated movement entity
   */
  async update(data: UpdateMovement): Promise<Movement> {
    const movementEntity = await this.movementRepository.findOne({
      where: {
        id: data.id,
      },
    });

    if (!movementEntity) {
      throw new NotFoundException('Entity not found');
    }

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

    const movement: MovementEntity = await this.movementRepository
      .save({
        ...movementEntity,
        ...partialEntity,
      })
      .catch((e) => {
        this.#logger.error(`Error updating movement: ${e.message}`);
        throw new InternalServerErrorException(e.message);
      });

    this.#logger.log(`Movement ${movement.id} updated`);

    return movement;
  }
}
