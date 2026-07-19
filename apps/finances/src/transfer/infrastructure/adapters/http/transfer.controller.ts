import { Body, Controller, Param, Post, UseInterceptors } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
import { IdempotencyInterceptor } from '../../../../idempotency/infrastructure/adapters/http';
import {
  TransferInputDto,
  TransferOutputDto,
  TransferReversalOutputDto,
} from '../../../application/dto';
import {
  CreateTransferUsecase,
  ReverseTransferUsecase,
} from '../../../application/usecases';

@Controller('transfers')
export class TransferController {
  constructor(
    private readonly createTransferUsecase: CreateTransferUsecase,
    private readonly reverseTransferUsecase: ReverseTransferUsecase,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: TransferInputDto,
  ): Promise<TransferOutputDto> {
    return this.createTransferUsecase.execute(input, user.id);
  }

  @Post(':transferGroup/reversal')
  async reverse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transferGroup') transferGroup: string,
  ): Promise<TransferReversalOutputDto> {
    return this.reverseTransferUsecase.execute(transferGroup, user.id);
  }
}
