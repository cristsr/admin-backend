import { ApiProperty } from '@nestjs/swagger';
import { CommandResult } from '@ledger/shared/application/ep1-contracts.assumed';

/**
 * The standard body of every write (RNF-10): the affected aggregate's id, its
 * new sequence, and the global stream position for read-your-writes (RNF-9).
 * Never a read view — to see the resource, the client issues a follow-up GET.
 */
export class CommandAcceptedDto {
  @ApiProperty({ format: 'uuid', description: 'Identifier of the affected aggregate.' })
  readonly id: string;

  @ApiProperty({ description: 'Per-aggregate sequence reached by this command.' })
  readonly sequence: number;

  @ApiProperty({ description: 'Global stream position for read-your-writes (RNF-9).' })
  readonly streamPosition: number;

  private constructor(id: string, sequence: number, streamPosition: number) {
    this.id = id;
    this.sequence = sequence;
    this.streamPosition = streamPosition;
  }

  /** Projects the write-only fields of a {@link CommandResult} into the response shape. */
  static from(result: CommandResult): CommandAcceptedDto {
    return new CommandAcceptedDto(result.aggregateId, result.sequence, result.streamPosition);
  }
}
