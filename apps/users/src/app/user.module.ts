import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'app/entities';
import { UserService, RolService } from 'app/services';
import { UserHandler } from 'app/handlers';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserService, RolService],
  providers: [UserHandler],
})
export class UserModule {}
