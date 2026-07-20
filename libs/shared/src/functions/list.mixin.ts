/** A response that wraps a collection under a `data` key. */
export interface ListMixin<T> {
  data: T[];
}
