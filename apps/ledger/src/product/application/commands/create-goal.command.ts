export class CreateGoalCommand {
  constructor(
    readonly userId: string,
    readonly name: string,
    readonly targetAmount: string,
    readonly targetDate: string,
  ) {}
}
