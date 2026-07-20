import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserRepository extends EntityRepository(UserEntity) {}
