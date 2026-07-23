/** Base for every query. `queryType` routes it to a handler on the query bus. */
export abstract class Query {
  abstract readonly queryType: string;
}
