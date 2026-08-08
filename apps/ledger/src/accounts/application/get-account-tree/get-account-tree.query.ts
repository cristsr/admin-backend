import { Query } from '@cqrs/application/query-bus/query';

/** One node of the account tree as `account_tree` stores it. */
export type AccountTreeRow = { readonly account_id: string; readonly name: string };

/** Returns the user's account tree ordered by name. */
export class GetAccountTreeQuery extends Query<readonly AccountTreeRow[]> {
  readonly queryType = 'GetAccountTree';
}
