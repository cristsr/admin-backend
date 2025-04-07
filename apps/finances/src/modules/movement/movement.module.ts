import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from 'app/modules/account/account.module';
import { CategoryModule } from 'app/modules/category/category.module';
import { MovementController } from 'app/modules/movement/controllers';
import { MovementEntity } from 'app/modules/movement/entities';
import { MovementRepository } from 'app/modules/movement/repositories';
import { MovementService } from 'app/modules/movement/services';
import { SubcategoryModule } from 'app/modules/subcategory/subcategory.module';

const Entities = TypeOrmModule.forFeature([MovementEntity]);
const Repositories = [MovementRepository];

@Module({
  imports: [
    Entities,
    CategoryModule,
    SubcategoryModule,
    forwardRef(() => AccountModule),
  ],
  controllers: [MovementController],
  providers: [...Repositories, MovementService],
  exports: [...Repositories],
})
export class MovementModule {}
