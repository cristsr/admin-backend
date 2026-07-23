import { Query } from '@ledger/shared-kernel/application/query-bus/query';

/** Returns the user's account tree ordered by name (RF-1, RF-13). */
export class GetAccountTreeQuery extends Query {
  readonly queryType = 'GetAccountTree';
}
