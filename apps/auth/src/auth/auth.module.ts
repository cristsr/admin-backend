import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Auth } from 'auth/controllers';
import { AuthService } from 'auth/services';
import { UserEntity } from 'auth/entities';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([UserEntity])],
  controllers: [Auth],
  providers: [AuthService],
})
export class AuthModule {}
