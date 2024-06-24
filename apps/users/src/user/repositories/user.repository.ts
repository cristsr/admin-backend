import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { UserEntity } from 'app/user/entities';

@Injectable()
export class UserRepository extends EntityRepository(UserEntity) {}
