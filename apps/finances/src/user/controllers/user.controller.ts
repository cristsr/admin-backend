import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  Id,
  Status,
  User,
  UserHandler,
  UserInput,
  UserQuery,
  Users,
} from '@core';
import { Public } from '@shared';
import { Observable } from 'rxjs';
import { UserService } from 'app/user/services';

@Controller('users')
export class UserController implements UserHandler {
  constructor(private userService: UserService) {}

  @Get()
  findAll(): Observable<Users> {
    return this.userService.findAll();
  }

  @Get(':id')
  getUser(@Param('id') id: number): Observable<User> {
    const queryUser: UserQuery = { id };
    return this.userService.findOne(queryUser);
  }

  @Public()
  @Get('/sub/:id')
  findBySubId(@Param('id') id: string): Observable<User> {
    const queryUser: UserQuery = { auth0Id: id };
    return this.userService.findOne(queryUser);
  }

  findOne(queryUser: UserQuery): Observable<User> {
    return this.userService.findOne(queryUser);
  }

  @Post()
  save(@Body() data: UserInput): Observable<User> {
    return this.userService.save(data);
  }

  @Delete(':id')
  deleteUser(@Param('id', ParseIntPipe) id: number): Observable<Status> {
    return this.userService.remove({ id });
  }

  remove(id: Id): Observable<Status> {
    return this.userService.remove(id);
  }
}
