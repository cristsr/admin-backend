import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  ACCOUNT_HANDLER,
  Account,
  AccountFilter,
  AccountHandler,
  AccountInput,
  Id,
} from '@admin-back/core';
import { AccountService } from 'app/account/services';

@Controller('finances')
export class AccountController implements AccountHandler {
  constructor(private accountService: AccountService) {}

  @GrpcMethod(ACCOUNT_HANDLER)
  findAll(filter: AccountFilter): Observable<Account[]> {
    return this.accountService.findAll(filter);
  }

  @GrpcMethod(ACCOUNT_HANDLER)
  findOne(id: Id): Observable<Account> {
    return this.accountService.findOne(id);
  }

  @GrpcMethod(ACCOUNT_HANDLER)
  save(data: AccountInput): Observable<Account> {
    return this.accountService.save(data);
  }
}
