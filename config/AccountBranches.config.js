/**
 * Sync Configuration: Account Branches (Delivery Addresses)
 * ------------------------------------------------------
 * Source (Intelisis):  Table `CteEnviarA`
 * Destination (Zoho):  Module `account_branches`
 * Direction:            Intelisis -> Zoho (one-way)
 *
 * IMPORTANT - execution order:
 * This module depends on Accounts and Price_Books already being
 * synced to Zoho. Each branch belongs to a customer (Cliente), so
 * Accounts MUST run before this module.
 *
 * IMPORTANT - composite key:
 * Codigo_ERP is built as `${Cliente}_${ID}` since a single customer
 * (Cliente) can have multiple delivery addresses (ID), and neither
 * field alone is unique across this table.
 *
 * IMPORTANT - Price_Books lookup uses "Name" as its key field, not
 * "Codigo_ERP" like other reference catalogs.
 */


module.exports = {
    sourceQuery: `SELECT 
                ID,
                Nombre, 
                Cliente,
                ListaPreciosEsp,
                Direccion,
                DireccionNumero, 
                Poblacion, 
                CodigoPostal, 
                Estado, 
                Pais
            FROM CteEnviarA`, // active accounts only

        sourceMap: {
            // composite key: no single "source", transform receives the full row
            code: { transform: (row) => `${row.Cliente}_${row.ID}` },
            name: { source: 'Nombre' },
            branchId: { source: 'ID' },
            clientCode: { source: 'Cliente' },       // FK to Accounts
            priceList: { source: 'ListaPreciosEsp' }, // FK to Price_Books (by Name)
            street: { source: 'Direccion' },
            streetNumber: { source: 'DireccionNumero' },
            city: { source: 'Poblacion' },
            zipCode: { source: 'CodigoPostal' },
            state: { source: 'Estado' },
            country: { source: 'Pais' },         // used for Owner (special lookup) and ERP_Agent (raw)
    },

    zohoModule: 'account_branches',
    duplicateCheckFields: ['Codigo_ERP'],

    // Reference catalogs that must already exist in Zoho before running this sync
    lookups: [
        { field: 'Account_name', canonical: 'clientCode', zohoModule: 'Accounts' },  // default keyField: Codigo_ERP
        { field: 'Price_Books', canonical: 'priceList', zohoModule: 'Price_Books', keyField: 'Name' },
    ],

    // Non-standard lookup: Zoho Users indexed by "alias", not by Codigo_ERP
    // (Zoho does not allow custom Codigo_ERP fields on the Users endpoint)
    specialLookups: {
        Owner: { endpoint: 'users', canonical: 'agent' },
    },


       destinationMap: {
            Name: { canonical: 'name' },
            Codigo_ERP: { canonical: 'code' },
            Branch_ID: { canonical: 'branchId' },
            Account_name: { canonical: 'clientCode', lookup: true },
            Price_Books: { canonical: 'priceList', lookup: true },
            Direcci_n_1_Street_Address: { canonical: 'street' },
            Direcci_n_1_Flat_House_No_Building_Apartment_Name: { canonical: 'streetNumber' },
            Direcci_n_1_City: { canonical: 'city' },
            Direcci_n_1_Zip_Postal_Code: { canonical: 'zipCode' },
            Direcci_n_1_State_Province: { canonical: 'state' },
            Direcci_n_1_Country_Region: { canonical: 'country' },
    }
};



