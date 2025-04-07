import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AccountFilter, AccountInput, UserAccountFilter } from '@core';
import { AccountService } from 'app/modules/account/services';

@Controller('accounts')
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Get()
  findOne(@Query() filter: UserAccountFilter) {
    return this.accountService.findOne(filter);
  }

  @Get('/query')
  findAll(@Query() filter: AccountFilter) {
    return this.accountService.findAll(filter);
  }

  @Post()
  save(@Body() data: AccountInput) {
    return this.accountService.save(data);
  }
}
