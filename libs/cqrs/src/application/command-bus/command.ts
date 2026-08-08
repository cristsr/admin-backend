/**
 * Base for every command. The bus routes on the concrete class, not on
 * `commandType`: the literal is what keeps two commands of identical shape
 * (`ConfirmTransaction` and `ReverseConfirmedTransaction` both carry only a
 * `transactionId`) distinct types, so their handlers cannot be swapped at
 * registration. It doubles as the human-readable label in errors and logs,
 * which `constructor.name` cannot be trusted to give under a minified build.
 */
export abstract class Command {
  abstract readonly commandType: string;
}
