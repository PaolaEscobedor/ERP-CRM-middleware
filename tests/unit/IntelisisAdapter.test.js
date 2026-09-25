const IntelisisAdapter = require('../../adapters/IntelisisAdapter');
const { getConnection } = require('../../models/db');

jest.mock('../../models/db');


describe('Intelisis Adaptes Unit Tests ', () => {
    let adapter;

    beforeEach(() => {
        adapter= new IntelisisAdapter();
        jest.clearAllMocks();
    });

    test('fetchCanonical should transform raw SQL rows into Canonical Data Model', async()  =>{
        const mockRows= [
            {Agente: 'V001', Nombre: 'Mario Gomez', Estatus: 'Alta', SucursalEmpresa: 101},
            {Agente: 'V002', Nombre: 'Gloria Flores', Estatus: 'ALTA', SucursalEmpresa: null}
        ];

        const mockPool={
            request: jest.fn().mockReturnThis(),
            query: jest.fn().mockResolvedValue({ recordset: mockRows })
        };

        getConnection.mockResolvedValue(mockPool);

        const mockConfig= {
            sourceQuery: 'SELECT Agente, Nombre, Estatus, SucursalEmpresa FROM Agente',
            sourceMap: {
                code: {source: 'Agente', transform: val => val.trim() },
                name: { source: 'Nombre' },
                status: { source: 'Estatus', transform: val => val.toUpperCase() },
                branch: { source: 'SucursalEmpresa', transform: val => val ? String(val) : '0' }
            }
        };

        const canonicalData = await adapter.fetchCanonical(mockConfig);

        expect(canonicalData).toHaveLength(2);
        expect(canonicalData[0]).toEqual({
            code: 'V001',
            name: 'Mario Gomez',
            status: 'ALTA',
            branch: '101'
        });
        expect(canonicalData[1].branch).toBe('0');
    });


    test('fetchCanonical should throw an error if datbase connection fails', async () => {
         getConnection.mockResolvedValue(null);

         const mockConfig = { sourceQuery: 'SELECT 1', sourceMap: {} };

         await expect(adapter.fetchCanonical(mockConfig))
         .rejects
         .toThrow('Not able to connect pool with database');

        
    });


    test('fetchCanonical should support composite keys via row-level transform', async () => {

        const mockRows = [
            { Cliente: 'A007', ID: 1, Nombre: 'Sucursal Centro' }
        ];

        const mockPool = {
            request: jest.fn().mockReturnThis(),
            query: jest.fn().mockResolvedValue({ recordset: mockRows })
        };

         getConnection.mockResolvedValue(mockPool);

        const mockConfig = {
            sourceQuery: 'SELECT Cliente, ID, Nombre FROM CteEnviarA',
            sourceMap: {
                code: { transform: (row) => `${row.Cliente}_${row.ID}` },
                name: { source: 'Nombre' }
            }
        };

        const canonicalData = await adapter.fetchCanonical(mockConfig);

        expect(canonicalData[0].code).toBe('A007_1')


    });
})