import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'app/entities';
import { UserService } from 'app/services';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserService],
})
export class UserModule {}
