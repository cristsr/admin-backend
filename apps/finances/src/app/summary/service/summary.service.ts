import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { DateTime } from 'luxon';
import { from, Observable } from 'rxjs';
import { Balance, Expenses, Movements, SummaryGrpc } from '@admin-back/grpc';
import { SummaryHandler } from 'app/summary/handler';

@GrpcService('finances')
export class SummaryService implements SummaryGrpc {
  constructor(private readonly summaryService: SummaryHandler) {}

  @GrpcMethod()
  balance(): Observable<Balance> {
    return from(this.summaryService.balance());
  }

  @GrpcMethod()
  expenses(_, metadata: Metadata): Observable<Expenses> {
    const date = DateTime.fromISO(metadata.get('clientDate')[0] as string);
    return from(this.summaryService.expenses(date));
  }

  @GrpcMethod()
  lastMovements(): Observable<Movements> {
    return from(this.summaryService.lastMovements());
  }
}
