/** Base for every command. `commandType` routes it to a handler on the bus. */
export abstract class Command {
  abstract readonly commandType: string;
}
