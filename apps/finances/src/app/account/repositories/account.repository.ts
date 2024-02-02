import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';
import { AccountEntity } from 'app/account/entities';

@Injectable()
export class AccountRepository extends EntityRepository(AccountEntity) {}
