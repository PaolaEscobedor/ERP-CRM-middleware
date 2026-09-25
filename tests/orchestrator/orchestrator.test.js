const { runSync } = require('../../sync/orchestrator');
const IntelisisAdapter = require('../../adapters/IntelisisAdapter');
const ZohoAdapter = require('../../adapters/ZohoAdapter');
const { zohoModule } = require('../../config/Accounts.config');


jest.mock('../../adapters/IntelisisAdapter');
jest.mock('../../adapters/ZohoAdapter');

beforeEach(() => {
    jest.clearAllMocks();
});


describe('Orchestrator Integration Test', () => {

    test('runSync should exctract canonical data and pass it to destination adapter, and close connection', async () => {
        const mockCanonical = [{code: 'P001', name: 'Product A'}];

        IntelisisAdapter.prototype.fetchCanonical.mockResolvedValue(mockCanonical);
        IntelisisAdapter.prototype.close.mockResolvedValue();
        ZohoAdapter.prototype.pushCanonical.mockResolvedValue({
            syncedCount: 1,
            errorCount: 0,
            expectedCount: 1
        });

        const mockConfig = {zohoModule: 'Products'};
        const result = await runSync(mockConfig, 'Products',  { closeConnection: true });

        expect(result.syncedCount).toBe(1);
        expect(IntelisisAdapter.prototype.fetchCanonical).toHaveBeenCalledWith(mockConfig);
        expect(ZohoAdapter.prototype.pushCanonical).toHaveBeenCalledWith(mockCanonical, mockConfig);
        expect(IntelisisAdapter.prototype.close).toHaveBeenCalled();
    });



    test('runSync should handle errors and ensure connections are closed',  async () => {
        const mockConfig = { zohoModule: 'Products' };
        IntelisisAdapter.prototype.fetchCanonical.mockRejectedValue(new Error('SQL Timeout'));
        IntelisisAdapter.prototype.close.mockResolvedValue();


        
        await expect(runSync(mockConfig, 'Products Sync Failure', { closeConnection: true })).rejects.toThrow('SQL Timeout');

        expect(IntelisisAdapter.prototype.close).toHaveBeenCalled();
    });
});
