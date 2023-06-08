import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { DateTime } from 'luxon';

@Scalar('Date', () => Date)
export class DateScalar implements CustomScalar<any, any> {
  description = 'Date custom scalar type';

  parseValue(value: string): string {
    return DateTime.fromISO(value).toISO(); // value from the client
  }

  serialize(value: string): Date {
    return DateTime.fromISO(value).toJSDate(); // value sent to the client
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.STRING) {
      return DateTime.fromISO(ast.value).toJSDate();
    }
    return null;
  }
}
