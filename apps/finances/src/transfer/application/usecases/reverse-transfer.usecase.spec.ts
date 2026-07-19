import { MovementType } from '../../../movement/domain/movement';
import {
  TransferAlreadyReversedException,
  TransferNotFoundException,
} from '../../domain';
import { ReverseTransferUsecase } from './reverse-transfer.usecase';

describe('ReverseTransferUsecase (AC-5)', () => {
  let movementRepository: any;
  let usecase: ReverseTransferUsecase;

  const originalLegs = [
    {
      id: 10,
      type: MovementType.TRANSFER_OUT,
      accountId: 1,
      amount: 100,
      currency: 'COP',
      transferGroup: 'grp',
      user: 7,
    },
    {
      id: 11,
      type: MovementType.TRANSFER_IN,
      accountId: 2,
      amount: 100,
      currency: 'COP',
      transferGroup: 'grp',
      user: 7,
    },
  ];

  beforeEach(() => {
    movementRepository = {
      findByTransferGroup: jest.fn(),
      saveAll: jest.fn().mockResolvedValue([{ id: 20 }, { id: 21 }]),
    };
    usecase = new ReverseTransferUsecase(movementRepository);
  });

  it('404 when the transferGroup does not exist for the user', async () => {
    movementRepository.findByTransferGroup.mockResolvedValue([]);
    await expect(usecase.execute('grp', 7)).rejects.toThrow(
      TransferNotFoundException,
    );
  });

  it('creates a compensating pair with a derived reversalTransferGroup', async () => {
    movementRepository.findByTransferGroup
      .mockResolvedValueOnce(originalLegs)
      .mockResolvedValueOnce([]);

    const result = await usecase.execute('grp', 7);

    expect(result.reversalTransferGroup).toBe('reversal:grp');
    expect(result.originalTransferGroup).toBe('grp');
    const savedLegs = movementRepository.saveAll.mock.calls[0][0];
    // types inverted relative to the original legs
    expect(savedLegs[0].type).toBe(MovementType.TRANSFER_IN);
    expect(savedLegs[1].type).toBe(MovementType.TRANSFER_OUT);
    expect(savedLegs.every((l: any) => l.transferGroup === 'reversal:grp')).toBe(
      true,
    );
  });

  it('409 when the transfer was already reversed', async () => {
    movementRepository.findByTransferGroup
      .mockResolvedValueOnce(originalLegs)
      .mockResolvedValueOnce([{ id: 20, transferGroup: 'reversal:grp' }]);

    await expect(usecase.execute('grp', 7)).rejects.toThrow(
      TransferAlreadyReversedException,
    );
    expect(movementRepository.saveAll).not.toHaveBeenCalled();
  });
});
