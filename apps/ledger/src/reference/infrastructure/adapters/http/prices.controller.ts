import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CommandBus } from '../../../shared-kernel/application/command/command-bus';
import { QueryBus } from '../../../shared-kernel/application/query/query-bus';
import { CurrentUser } from '../../../shared/application/decorators/current-user.decorator';
import { LedgerContext } from '../../../shared/domain/ledger-context';
import { AuthGuard } from '../../../shared/infrastructure/guards/auth.guard';
import { RecordPriceCommand } from '../../application/commands/record-price.command';
import { ResolvePriceQuery } from '../../application/queries/resolve-price.query';
import { PriceOutputDto } from '../../application/dto/price-output.dto';

@Controller('reference/prices')
@UseGuards(AuthGuard)
export class PricesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async resolve(
    @CurrentUser() context: LedgerContext,
    @Query('base') base: string,
    @Query('quote') quote: string,
    @Query('date') date: string,
    @Query('source') source?: string,
  ): Promise<PriceOutputDto | null> {
    return this.queryBus.ask(new ResolvePriceQuery(context.userId, base, quote, date, source));
  }

  @Post()
  async record(
    @CurrentUser() context: LedgerContext,
    @Body() dto: { base: string; quote: string; date: string; rate: string; source: string },
  ): Promise<void> {
    await this.commandBus.dispatch(
      new RecordPriceCommand(
        context.userId,
        dto.base,
        dto.quote,
        dto.date,
        dto.rate,
        dto.source,
      ),
    );
  }
}
