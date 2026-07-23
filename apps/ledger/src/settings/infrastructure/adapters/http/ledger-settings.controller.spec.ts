import { LedgerSettingsController } from './ledger-settings.controller';
import { CommandBus } from '../../../shared-kernel/application/command/command-bus';
import { QueryBus } from '../../../shared-kernel/application/query/query-bus';
import { LedgerContext } from '../../../shared/domain/ledger-context';
import { LedgerSettingsOutputDto } from '../../application/dto';

describe('LedgerSettingsController', () => {
  let controller: LedgerSettingsController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;

  beforeEach(() => {
    mockCommandBus = { dispatch: jest.fn().mockResolvedValue(void 0) } as any;
    mockQueryBus = {
      ask: jest.fn().mockResolvedValue(
        new LedgerSettingsOutputDto('user-123', 'COP', 'America/Bogota', new Date()),
      ),
    } as any;

    controller = new LedgerSettingsController(mockCommandBus, mockQueryBus);
  });

  describe('GET /ledger/settings', () => {
    it('should return ledger settings', async () => {
      const context = { userId: 'user-123', clientId: 'client-1' } as LedgerContext;

      const result = await controller.getSettings(context);

      expect(result).toBeInstanceOf(LedgerSettingsOutputDto);
      expect(mockQueryBus.ask).toHaveBeenCalled();
    });
  });

  describe('PATCH /ledger/settings', () => {
    it('should dispatch commands for changed settings', async () => {
      const context = { userId: 'user-123' } as LedgerContext;
      const dto = { presentationCurrency: 'USD', timezone: 'UTC' };

      const result = await controller.updateSettings(context, dto);

      expect(mockCommandBus.dispatch).toHaveBeenCalledTimes(2);
      expect(result.message).toBe('Settings updated');
    });
  });
});
