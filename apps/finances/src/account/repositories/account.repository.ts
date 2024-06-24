import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@shared';
import { AccountEntity } from 'app/account/entities';

@Injectable()
export class AccountRepository extends EntityRepository(AccountEntity) {}
