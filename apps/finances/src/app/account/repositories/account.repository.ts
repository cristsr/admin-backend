import { AccountEntity } from 'app/account/entities';
import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@admin-back/shared';

@Injectable()
export class AccountRepository extends EntityRepository(AccountEntity) {}
