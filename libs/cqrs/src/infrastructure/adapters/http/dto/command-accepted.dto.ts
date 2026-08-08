import { ApiProperty } from '@nestjs/swagger';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';

/**
 * The standard body of every write: the affected aggregate's id and the
 * global stream position for read-your-writes. The position is a `bigint`
 * in the core and is serialized as a decimal string here so it survives JSON
 * without precision loss. Never a read view — to see the resource, the client
 * issues a follow-up GET.
 */
export class CommandAcceptedDto {
  @ApiProperty({ format: 'uuid', description: 'Identifier of the affected aggregate.' })
  readonly id: string;

  @ApiProperty({ description: 'Global stream position for read-your-writes, as a decimal string.' })
  readonly streamPosition: string;

  private constructor(id: string, streamPosition: string) {
    this.id = id;
    this.streamPosition = streamPosition;
  }

  /** Projects the write-only fields of a {@link CommandResult} into the response shape. */
  static from(result: CommandResult): CommandAcceptedDto {
    return new CommandAcceptedDto(result.aggregateId, String(result.streamPosition));
  }
}
