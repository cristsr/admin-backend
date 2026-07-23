import { GetLedgerSettingsHandler } from './get-ledger-settings.handler';
import { GetLedgerSettingsQuery } from '../queries';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';

describe('GetLedgerSettingsHandler', () => {
  let handler: GetLedgerSettingsHandler;
  let mockReadModelStore: jest.Mocked<ReadModelStore>;

  beforeEach(() => {
    mockReadModelStore = {
      query: jest.fn(),
    } as any;

    handler = new GetLedgerSettingsHandler(mockReadModelStore);
  });

  it('should return ledger settings from projection', async () => {
    const userId = 'user-123';
    const mockRow = {
      user_id: userId,
      presentation_currency: 'COP',
      timezone: 'America/Bogota',
      updated_at: new Date().toISOString(),
    };

    mockReadModelStore.query.mockResolvedValue([mockRow]);

    const query = new GetLedgerSettingsQuery(userId);
    const result = await handler.execute(query);

    expect(result.userId).toBe(userId);
    expect(result.presentationCurrency).toBe('COP');
    expect(result.timezone).toBe('America/Bogota');
    expect(mockReadModelStore.query).toHaveBeenCalledWith(
      'proj_ledger_settings',
      { user_id: userId },
    );
  });
});
