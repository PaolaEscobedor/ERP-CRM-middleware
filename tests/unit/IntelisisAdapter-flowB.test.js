// Keep the real mssql types (Int, Float, VarChar...), mock only Transaction and Request
jest.mock('mssql', () => {
    const actual = jest.requireActual('mssql');
    return { ...actual, Transaction: jest.fn(), Request: jest.fn() };
});
jest.mock('../../models/db');

const mssql = require('mssql');
const { getConnection } = require('../../models/db');
const IntelisisAdapter = require('../../adapters/IntelisisAdapter');


const config={
    headerProcedure:'pNetActualizarPedido',
    detailProcedure: 'pNetActualizarPedidoD',
    idempotency: {
        table: 'Venta',
        column: 'FolioCRM',
        canonical: 'externalId',
        editableStatuses: ['SINAFECTAR', 'CONFIRMAR'],
    },
    headerSpParameters: {
        Usuario: { canonical: 'user', type: mssql.VarChar(10) },
        Cliente: { canonical: 'customer', type: mssql.VarChar(10) },
        FolioCRM: { canonical: 'externalId', type: mssql.VarChar(50) },
        DescuentoGlobal: { canonical: 'globalDiscount', type: mssql.Float },
        TotalDet: { canonical: 'totalItems', type: mssql.Int },
    },
    detailSpParameters: {
        Articulo: { canonical: 'itemCode', type: mssql.VarChar(20) },
        Cantidad: { canonical: 'quantity', type: mssql.Float },
    },
};

const canonicalRecord = {
    externalId: '7463151000000901025',
    user: 'DEMO', 
    customer: 'A007', 
     globalDiscount: '4.94', // reverse lookups return strings
    totalItems: 2,
    lineItems: [
        { itemCode: 'PT-000005', quantity: 10 },
        { itemCode: 'PT-000006', quantity: 5 },
    ],
};


// Helper: shape of an SP result with a single row
const spRow = (row) => ({ recordset: [row] });

describe('IntelisisAdapter - Flow B (Zoho -> Intelisis)', () => {

    let adapter;
    let transaction;
    let requests;     // every mssql.Request created, in order: [0] lookup, [1] header, [2..] lines
    let queryResult; // result of idempotency 
    let executeResults; 


    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(()=> {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });


    afterAll(() => {
        console.log.mockRestore();
        console.error.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        adapter= new IntelisisAdapter();
        requests = [];
        queryResult= { recordset: [] };
        executeResults= [];


        transaction= {
            begin: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
        };

        mssql.Transaction.mockImplementation(()=> transaction);

        mssql.Request.mockImplementation(() => {
            const request = {
                input: jest.fn(),
                query: jest.fn(() => Promise.resolve(queryResult)),
                execute: jest.fn(() => {
                    const next= executeResults.shift();
                    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
                }),
            };
            requests.push(request);
            return request;
        });

        getConnection.mockResolvedValue({});

    });


    // ---------------------------------------------------------------
    // _bindParameters
    // ---------------------------------------------------------------
    test('_bindParameters calls request.input once per parameter (regression)', () => {
        const request = { input: jest.fn() };

        adapter._bindParameters(request, canonicalRecord, config.headerSpParameters);

        // Before the fix, request.input() was never called and the SP ran with no parameters
        expect(request.input).toHaveBeenCalledTimes(Object.keys(config.headerSpParameters).length);

    });

    test('_bindParameters coerces string values to the declared Float and Int types', () => {
        const request = { input: jest.fn() };

        adapter._bindParameters(request, { globalDiscount: '4.94', totalItems: '2' }, config.headerSpParameters);

        expect(request.input).toHaveBeenCalledWith('DescuentoGlobal', mssql.Float, 4.94);
        expect(request.input).toHaveBeenCalledWith('TotalDet', mssql.Int, 2);

    });

    test('_bindParameters sends null instead of undefined for missing fields', () => {
        const request = { input: jest.fn() };

        adapter._bindParameters(request, { user: 'DEMO' }, config.headerSpParameters);

        // undefined would be sent as "parameter not supplied" and fail on mandatory SP params

        expect(request.input).toHaveBeenCalledWith('Cliente', expect.anything(), null);
    });

    // ---------------------------------------------------------------
    // pushCanonical: happy paths
    // ---------------------------------------------------------------

    test('inserts a new order (header + lines) and commits when the CRM record was not imported before', async () => {
        executeResults = [
            spRow({ID: 100, Ok: null, OkRef: null}), //header
            spRow({ Ok: null, OkRef: null }),          // line 1
            spRow({ Ok: null, OkRef: null }),          // line 2
        ];


        const result= await adapter.pushCanonical(canonicalRecord, config);

        expect(result.action).toBe('insert');
        expect(result.syncedCount).toBe(1);
        expect(transaction.commit).toHaveBeenCalledTimes(1);
        expect(transaction.rollback).not.toHaveBeenCalled();


        //header  is created without @ID; each line is linked to the new header ID

        expect(requests[1].input).not.toHaveBeenCalledWith('ID', expect.anything(), expect.anything());
        expect(requests[1].execute).toHaveBeenCalledWith('pNetActualizarPedido');
        expect(requests[2].input).toHaveBeenCalledWith('ID', mssql.Int, 100);
        expect(requests[2].execute).toHaveBeenCalledWith('pNetActualizarPedidoD');
        expect(requests[3].input).toHaveBeenCalledWith('ID', mssql.Int, 100);
    });


    test('updates the existing order instead of duplicating it when the CRM record was already imported', async () => {
        queryResult = { recordset: [{ ID: 55, Estatus: 'CONFIRMAR      ' }] }; // CHAR padding from SQL Server
        executeResults=[
            spRow({ID: 55, Ok: null }),
            spRow({ Ok: null}),
            spRow({ Ok: null}),


        ];

        const result = await adapter.pushCanonical(canonicalRecord, config);

        expect(result.action).toBe('update');
        expect(result.syncedCount).toBe(1);
        // the lookup searched by the Zoho record ID
        expect(requests[0].input).toHaveBeenCalledWith('externalId', expect.anything(), '7463151000000901025');
        // the header SP received the existing ID, so it updates instead of inserting
        expect(requests[1].input).toHaveBeenCalledWith('ID', mssql.Int, 55);
        expect(transaction.commit).toHaveBeenCalledTimes(1);
    });


    // ---------------------------------------------------------------
    // pushCanonical: integrity and rollback
    // ---------------------------------------------------------------
    test('rejects re-syncing an order that is no longer in an editable status', async () => {
        queryResult = { recordset: [{ ID: 55, Estatus: 'CONCLUIDO' }] };

        const result= await adapter.pushCanonical(canonicalRecord, config);

        expect(result.syncedCount).toBe(0);
        expect(result.error).toMatch(/can no longer be modified/);
        expect(transaction.rollback).toHaveBeenCalledTimes(1);
        expect(transaction.commit).not.toHaveBeenCalled();
        expect(requests).toHaveLength(1); // only the lookup ran; no SP was executed
    });


    test('rolls back and skips the lines when the header SP returns a business error', async () => {
        executeResults = [spRow({ ID: null, Ok: 30040, OkRef: 'Falta indicar la moneda' })];

        const result= await adapter.pushCanonical(canonicalRecord, config);

        expect(result.syncedCount).toBe(0);
        expect(result.spResult.Ok).toBe(30040);
        expect(transaction.rollback).toHaveBeenCalledTimes(1);
        expect(transaction.commit).not.toHaveBeenCalled();
        expect(requests).toHaveLength(2); // lookup + header; no line was sent
    });


    test('rolls back the whole order (header included) when any line fails', async () => {
        executeResults = [
            spRow({ ID: 100, Ok: null }),                       // header OK
            spRow({ Ok: null }),                                // line 1 OK
            spRow({ Ok: 20150, OkRef: 'Falta indicar la unidad' }), // line 2 fails
        ];

        const result = await adapter.pushCanonical(canonicalRecord, config);

        expect(result.syncedCount).toBe(0);
        expect(result.error).toMatch(/PT-000006/);
        expect(result.lineResults).toHaveLength(2);
        expect(transaction.rollback).toHaveBeenCalledTimes(1);
        expect(transaction.commit).not.toHaveBeenCalled();
    });

    test('rolls back and reports the error when an SP call throws unexpectedly', async () => {
        executeResults = [new Error('Connection lost')];

        const result = await adapter.pushCanonical(canonicalRecord, config);


        expect(result.syncedCount).toBe(0);
        expect(result.error).toBe('Connection lost');
        expect(transaction.rollback).toHaveBeenCalled();
        expect(transaction.commit).not.toHaveBeenCalled();

    });

});


    


