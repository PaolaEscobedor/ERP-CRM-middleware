const ZohoAdapter = require('../../adapters/ZohoAdapter');
const axios = require('axios');
const { getAccessToken } = require('../../services/zohoAuth');

jest.mock('axios');
jest.mock('../../services/zohoAuth');

const API = 'https://www.zohoapis.com';

describe('Zoho Adapter - Flow B (zoho - Intelisis)', () => {
    let adapter;

    beforeEach (() =>{
        jest.clearAllMocks();
        adapter= new ZohoAdapter();
        getAccessToken.mockResolvedValue({ accessToken: 'mock_token', apiDomain: API });
    });

    // ---------------------------------------------------------------
    // getRecord
    // ---------------------------------------------------------------

    test('getRecord fetches a single record by module and ID', async () => {
        axios.get.mockResolvedValueOnce({ data: { data: [{ id: '123', Subject: 'Prueba1'}] } });

        const record = await adapter.getRecord('Sales_Orders', '123');

        expect(axios.get).toHaveBeenCalledWith(`${API}/crm/v8/Sales_Orders/123`, expect.any(Object));
        expect(record).toEqual({ id: '123', Subject: 'Prueba1' });
    });


    test('getRecord returns null when the record does not exist', async () => {
        axios.get.mockResolvedValueOnce({ data: { data: [] } });
        const record= await adapter.getRecord('Sales_Orders', '999');

        expect(record).toBeNull();
    });


    // ---------------------------------------------------------------
    // fetchReverseMap
    // ---------------------------------------------------------------


    test('fetchReverseMap builds a { zohoId: code } map across pages and keeps 0 values', async () => {
        axios.get.mockResolvedValueOnce({
            data: { data: [{ id: 'z1', Codigo_ERP: 'A007'}], info: {more_records: true}}
        }).mockResolvedValueOnce({
            data: { data:[{ id: 'z2', Codigo_ERP: 0}, { id: 'z3', Codigo_ERP: null }], info: { more_records: false }}
        });

        const map= await adapter.fetchReverseMap('Accounts', 'Codigo_ERP');

        // trailing spaces trimmed, 0 kept (falsy-value regression), null discarded
        expect(map).toEqual({ z1: 'A007', z2: '0' });
        expect(axios.get).toHaveBeenCalledTimes(2);

    });


    // ---------------------------------------------------------------
    // fetchUsersReverseMap
    // ---------------------------------------------------------------

    test('fetchUsersReverseMap maps Zoho user IDs to their alias, skipping users without alias', async () => {
        axios.get.mockResolvedValueOnce({ data: { users: [{ id: 'u1', alias: 'V00002' }, { id: 'u2' }] }
        });

        const map = await adapter.fetchUsersReverseMap();

        expect(axios.get).toHaveBeenCalledWith(`${API}/crm/v8/users`, expect.any(Object));
        expect(map).toEqual({ u1: 'V00002' });
    });

 // ---------------------------------------------------------------
// buildCanonicalFromZohoRecord
// ---------------------------------------------------------------

    describe('buildCanonicalFromZohoRecord', () => {
        const config = {
            sourceMap: {
                externalId: {zohoField: 'id'},
                user: {zohoField: '__unused__', defaultValue: 'DEMO' }, 
                customer: { zohoField: 'Account_Name'},
                agent: {zohoField: 'Owner'}, 
                priceList: { zohoField: 'price_list'}, 
                reference: {// no zohoField: the transform receives the full record
                    transform: (record) => [record.SO_Number, record.Reference].filter(Boolean).join(' - ')
                    },
                totalItems:{
                    zohoField: 'Ordered_Items',
                    transform: (items) => (Array.isArray(items) ? items.length : 0)
                    },
                },
            reverseLookups: [
                { field: 'customer', zohoModule: 'Accounts', keyField: 'Codigo_ERP' },
                { field: 'priceList', zohoModule: 'Price_Books', keyField: 'Codigo_ERP' },
            ],
            specialReverseLookups: {
                agent: { endpoint: 'users' },
            },
        };  

        const zohoRecord= {
            id: '7463151000000901025', 
            SO_Number: '7463151000000901025', 
            Reference: 'Prueba',
            Account_Name: { id: 'acc1', name: 'ENVASES TPK' },
            Owner: { id: 'u1', name: 'Lamitec Admin', email: 'admin@test.com' },
            price_list: {id: '(PrecioLista)', name: 'Unknown list'}, 
            Ordered_Items: [{}, {}],
        };

        beforeEach(() => {
            // Route each Zoho call to its mocked catalog
            axios.get.mockImplementation((url) => {
                if (url.includes('/crm/v8/users')) {
                    return Promise.resolve({data: { users: [{ id: 'u1', alias: 'V00002' }] } });
                }
                if (url.includes('/crm/v8/Accounts?')) {
                    return Promise.resolve({data: { data: [{ id: 'acc1', Codigo_ERP: 'A007' }], info: { more_records: false } }});
                }
                if (url.includes('/crm/v8/Price_Books?')) {
                    return Promise.resolve({data: { data: [{ id:'pb1', Codigo_ERP: 'FerretZona6' }], info: { more_records: false } }});
                }
                return Promise.reject(new Error(`Unexpected URL in test: ${url}`));

            });             

        });

        test('translates lookup fields from { id, name } objects into Intelisis codes', async () => {
            const canonical = await adapter.buildCanonicalFromZohoRecord(zohoRecord, config);

            expect(canonical.customer).toBe('A007');

        });

        test('resolves agent from the record Owner via specialReverseLookups (regression)', async () => {
            const canonical = await adapter.buildCanonicalFromZohoRecord(zohoRecord, config);

            //Before the fix agent came back raw ({name, id, email}) object
            expect(canonical.agent).toBe('V00002');
        });


        test('uses defaultValue when the Zoho field does not exist', async () => {
            const canonical = await adapter.buildCanonicalFromZohoRecord(zohoRecord, config);

            expect(canonical.user).toBe('DEMO');
        });


        test('passes the full record to transforms without zohoField', async () => {
            const canonical = await adapter.buildCanonicalFromZohoRecord(zohoRecord, config);


            expect(canonical.reference).toBe('7463151000000901025 - Prueba');
        });

        test('maps the Zoho record ID to externalId for idempotency', async () => {
            const canonical = await adapter.buildCanonicalFromZohoRecord(zohoRecord, config);

            expect(canonical.externalId).toBe('7463151000000901025');
        
        });

        test('resolves to null when a lookup has no match in the catalog', async () => {
            const canonical = await adapter.buildCanonicalFromZohoRecord(zohoRecord, config);

            expect(canonical.priceList).toBeNull();
        });

        test('applies field transforms to the raw value', async () => {
            const canonical = await adapter.buildCanonicalFromZohoRecord(zohoRecord, config);

            expect(canonical.totalItems).toBe(2);

        });

                
    });

});