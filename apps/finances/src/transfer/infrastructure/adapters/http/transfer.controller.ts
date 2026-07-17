import { Body, Controller, Post } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
import { TransferInputDto, TransferOutputDto } from '../../../application/dto';
import { CreateTransferUsecase } from '../../../application/usecases';

@Controller('transfers')
export class TransferController {
  constructor(private readonly createTransferUsecase: CreateTransferUsecase) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: TransferInputDto,
  ): Promise<TransferOutputDto> {
    return this.createTransferUsecase.execute(input, user.id);
  }
}
