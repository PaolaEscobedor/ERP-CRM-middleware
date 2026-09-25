const ZohoAdapter = require('../../adapters/ZohoAdapter');
const axios = require('axios');
const { getAccessToken } = require('../../services/zohoAuth');

jest.mock('axios');
jest.mock('../../services/zohoAuth');

describe('ZohoAdapter Unit Tests', () => {
    let adapter;

    beforeEach(() => {
        adapter = new ZohoAdapter();
        jest.clearAllMocks();
        getAccessToken.mockResolvedValue({
            accessToken: 'mock_token',
            apiDomain: 'https://www.zohoapis.com'
        });
    });

    test('fetchMap should handle multi-page API responses and build key-id dictionary' , async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                data: [{ id: 'z101', Codigo_ERP: 'C001'}],
                info: {more_records: true}
            }
        })
        .mockResolvedValueOnce({
                data: {
                    data: [{ id: 'z102', Codigo_ERP: 'C002' }],
                    info: { more_records: false }
                }
            });

            const map = await adapter.fetchMap('Accounts', 'Codigo_ERP');

        expect(Object.keys(map)).toHaveLength(2);
        expect(map['C001']).toBe('z101');
        expect(map['C002']).toBe('z102');
        expect(axios.get).toHaveBeenCalledTimes(2);
    });


    test('fetchMap shoul NOT discard records with falsy key value (0)', async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                data: [{ id: 'z100', Codigo_ERP: 0 }],
                info: { more_records: false }
            }
        });

        const map = await adapter.fetchMap('Branches', 'Codigo_ERP');

        expect(Object.keys(map)).toHaveLength(1);
        expect(map['0']).toBe('z100');
    });


    test('_resolveLookups should use a custom keyField when provided', async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                data: [{ id: 'zpb1', Name: 'FerretZona6' }],
                info: { more_records: false }
            }
        });


        const config = {
            lookups: [
                {field: 'Price_Books', canonical:'pricelist', zohoModule: 'Price_Books', keyField: 'Name'}
            ]
        };


        const maps = await adapter._resolveLookups(config);

        expect(maps['Price_Books']['FerretZona6']).toBe('zpb1');
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('fields=id,Name'),
            expect.any(Object)
        );
    });


    test('pushCanonical should translate CDM records and process upserts in batches', async () => {
        axios.get.mockResolvedValue({ data: { data: [], info: { more_records: false } } });

        axios.post.mockResolvedValue({
            data: {
                data: [
                    { status: 'success', action: 'update', details: { id: 'z101' } },
                    { status: 'error', code: 'INVALID_DATA', message: 'Invalid field value', details: {} }
                ]
            }
        });

        const mockCanonicalRecords = [
            { code: 'C001', name: 'Client A' },
            { code: 'C002', name: 'Client B' }
        ];

        const mockConfig = {
            zohoModule: 'Accounts',
            duplicateCheckFields: ['Codigo_ERP'],
            lookups: [],
            destinationMap: {
                Name: { canonical: 'name' },
                Codigo_ERP: { canonical: 'code' }
            }
        };

        const result = await adapter.pushCanonical(mockCanonicalRecords, mockConfig);

        expect(result.syncedCount).toBe(1);
        expect(result.errorCount).toBe(1);
        expect(result.expectedCount).toBe(2);
        expect(axios.post).toHaveBeenCalledWith(
            'https://www.zohoapis.com/crm/v8/Accounts/upsert',
            expect.objectContaining({
                duplicate_check_fields: ['Codigo_ERP']
            }),
            expect.any(Object)
        );
    });


    test('pushCanonical should chink records into batches of 100 when payload exceeds limit', async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                data: [],
                info: { more_records: false }
            }
        });

        // Create 105 synthetic records
        const mockLargePayload = Array.from({length: 105}, (_, i) => ({
            code:`C${i}`,
            name: `Client ${i}`
        }));

        const mockConfig = {
            zohoModule: 'Accounts',
            duplicateCheckFields: ['Codigo_ERP'],
            lookups: [],
            destinationMap: { Name: { canonical: 'name' }, Codigo_ERP: { canonical: 'code' } }
        };

        await adapter.pushCanonical(mockLargePayload, mockConfig);

        // It should call axios.post 2 times
        expect(axios.post).toHaveBeenCalledTimes(2);
    });
});