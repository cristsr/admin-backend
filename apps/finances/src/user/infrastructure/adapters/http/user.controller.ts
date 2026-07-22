import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserInputDto, UserOutputDto, UserRemovedOutputDto } from '@app/user/application/dto';
import { UserMapper } from '@app/user/application/mappers';
import {
  FindAllUsersUsecase,
  FindUserUsecase,
  RemoveUserUsecase,
  SaveUserUsecase,
} from '@app/user/application/usecases';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly findAllUsersUsecase: FindAllUsersUsecase,
    private readonly findUserUsecase: FindUserUsecase,
    private readonly saveUserUsecase: SaveUserUsecase,
    private readonly removeUserUsecase: RemoveUserUsecase,
  ) {}

  @Get()
  async findAll(): Promise<UserOutputDto[]> {
    return this.findAllUsersUsecase.execute();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserOutputDto> {
    return this.findUserUsecase.execute(id);
  }

  @Post()
  async save(@Body() data: UserInputDto): Promise<UserOutputDto> {
    const user = await this.saveUserUsecase.execute(data);
    return UserMapper.toOutput(user);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<UserRemovedOutputDto> {
    return this.removeUserUsecase.execute(id);
  }
}
