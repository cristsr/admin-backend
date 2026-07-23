/**
 * Command to change the user's timezone.
 */
export class ChangeTimezoneCommand {
  constructor(
    readonly userId: string,
    readonly timezone: string,
    readonly externalRef?: string,
  ) {}
}
