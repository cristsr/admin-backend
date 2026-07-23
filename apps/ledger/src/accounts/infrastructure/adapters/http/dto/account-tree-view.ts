/**
 * How the `account_tree` projection is shaped in the HTTP response: nested
 * (`tree`) or flattened (`flat`). Presentation-only concern owned by the driving
 * adapter; the read model always stores the flat rows.
 *
 * TODO(read-shape): the real {@link GetAccountTreeQuery} does not yet honor the
 * view — the tree/flat shaping is applied at the adapter once the read handler
 * returns nesting metadata.
 */
export enum AccountTreeView {
  TREE = 'tree',
  FLAT = 'flat',
}
