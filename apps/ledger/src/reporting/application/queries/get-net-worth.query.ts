export class GetNetWorthQuery {
  constructor(readonly userId: string, readonly asOfDate?: string) {}
}
