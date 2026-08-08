import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';
import { Nullable } from '@shared';
import { AccountType } from '@ledger/shared/domain/value-objects';

/** Construction shape for {@link AccountOpened}. */
export type AccountOpenedProps = {
  readonly accountId: string;
  readonly type: AccountType;
  readonly name: string;
  readonly parentName: Nullable<string>;
  readonly currencies: readonly string[];
  readonly openedOn: string;
  readonly isBankMirror: boolean;
  readonly isSystem: boolean;
};

/** An account was opened under one of the five root types. */
export class AccountOpened extends DomainEvent {
  readonly eventType = 'AccountOpened';
  readonly schemaVersion = 1;

  constructor(readonly props: AccountOpenedProps) {
    super();
  }

  static fromPayload(payload: EventPayload): AccountOpened {
    return new AccountOpened({
      accountId: payload.accountId as string,
      type: payload.type as AccountType,
      name: payload.name as string,
      parentName: (payload.parentName as Nullable<string>) ?? null,
      currencies: payload.currencies as string[],
      openedOn: payload.openedOn as string,
      isBankMirror: payload.isBankMirror as boolean,
      isSystem: payload.isSystem as boolean,
    });
  }

  toPayload(): EventPayload {
    return { ...this.props };
  }
}
