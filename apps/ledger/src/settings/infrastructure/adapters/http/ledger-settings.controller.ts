import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '../../../shared-kernel/application/command/command-bus';
import { QueryBus } from '../../../shared-kernel/application/query/query-bus';
import { AuthGuard } from '../../../shared/infrastructure/adapters/http/guards/auth.guard';
import { CurrentUser } from '../../../shared/infrastructure/adapters/http/decorators/current-user.decorator';
import { LedgerContext } from '../../../shared/domain/ledger-context';
import { ChangePresentationCurrencyCommand, ChangeTimezoneCommand } from '../../application/commands';
import { GetLedgerSettingsQuery } from '../../application/queries';
import { ChangeSettingsInputDto, LedgerSettingsOutputDto } from '../../application/dto';

/**
 * HTTP endpoints for ledger settings.
 */
@Controller('ledger/settings')
@UseGuards(AuthGuard)
export class LedgerSettingsController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Get()
  async getSettings(@CurrentUser() context: LedgerContext): Promise<LedgerSettingsOutputDto> {
    const query = new GetLedgerSettingsQuery(context.userId);
    return this.queryBus.ask(query);
  }

  @Patch()
  @HttpCode(202)
  async updateSettings(
    @CurrentUser() context: LedgerContext,
    @Body() dto: ChangeSettingsInputDto,
  ): Promise<{ message: string }> {
    if (dto.presentationCurrency) {
      const command = new ChangePresentationCurrencyCommand(
        context.userId,
        dto.presentationCurrency,
      );
      await this.commandBus.dispatch(command);
    }

    if (dto.timezone) {
      const command = new ChangeTimezoneCommand(context.userId, dto.timezone);
      await this.commandBus.dispatch(command);
    }

    return { message: 'Settings updated' };
  }
}
