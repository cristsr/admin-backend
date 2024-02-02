import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from 'app/account/account.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementEntity } from 'app/movement/entities';
import { MovementRepository } from 'app/movement/repositories';
import { MovementService } from 'app/movement/services';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';

const Entities = TypeOrmModule.forFeature([MovementEntity]);
const Repositories = [MovementRepository];

@Module({
  imports: [
    Entities,
    CategoryModule,
    SubcategoryModule,
    forwardRef(() => AccountModule),
  ],
  controllers: [MovementService],
  providers: [...Repositories],
  exports: [...Repositories],
})
export class MovementModule {}
