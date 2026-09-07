/**
 * Sync Configuration: Accounts
 * ------------------------------------------------------
 * Source (Intelisis):  Table `Cte`
 * Destination (Zoho):  Module `Accounts`
 * Direction:            Intelisis -> Zoho (one-way)
 * 
 * 
 *  IMPORTANT - execution order:
 * This module depends on 6 reference catalogs that must be synced
 * FIRST: account_category, account_group, account_family,
 * sales_payment_terms, Price_Books, sales_warehouses. It also
 * depends on Zoho Users already existing (via specialLookups.Owner).
 * If any of these are missing, the corresponding fields resolve to null.
 */
 


module.exports = {
    sourceQuery: `SELECT 
                Cliente, Nombre, eMail1, RFC, Telefonos, 
                Direccion, Poblacion, Estado, CodigoPostal, Pais, 
                ListaPreciosEsp, Condicion, CreditoLimite, 
                AlmacenDef, Categoria, Grupo, Familia, FiscalRegimen, Descuento,
                Agente
            FROM Cte 
            WHERE Estatus = 'ALTA'`, // active accounts only

        sourceMap: {
        code: { source: 'Cliente' },
        name: { source: 'Nombre' },
        email: { source: 'eMail1' },
        taxId: { source: 'RFC' },
        phone: { source: 'Telefonos' },
        street: { source: 'Direccion' },
        city: { source: 'Poblacion' },
        state: { source: 'Estado' },
        zipCode: { source: 'CodigoPostal' },
        country: { source: 'Pais' },
        priceList: { source: 'ListaPreciosEsp' },       // FK to Price_Books
        paymentTerms: { source: 'Condicion' },          // FK to sales_payment_terms
        creditLimit: { source: 'CreditoLimite' },
        defaultWarehouse: { source: 'AlmacenDef' },     // FK to sales_warehouses
        category: { source: 'Categoria' },              // FK to account_category
        group: { source: 'Grupo' },                     // FK to account_group
        family: { source: 'Familia' },                  // FK to account_family
        taxRegime: { source: 'FiscalRegimen' },
        discount: { source: 'Descuento' },
        agent: { source: 'Agente' },                    // used for Owner (special lookup) and ERP_Agent (raw)
    },

    zohoModule: 'Accounts',
    duplicateCheckFields: ['Codigo_ERP'],

    // Reference catalogs that must already exist in Zoho before running this sync
    lookups: [
        { field: 'price_list', canonical: 'priceList', zohoModule: 'Price_Books' },
        { field: 'payment_terms', canonical: 'paymentTerms', zohoModule: 'sales_payment_terms' },
        { field: 'default_warehouse', canonical: 'defaultWarehouse', zohoModule: 'sales_warehouses' },
        { field: 'account_category', canonical: 'category', zohoModule: 'account_category' },
        { field: 'account_group', canonical: 'group', zohoModule: 'account_group' },
        { field: 'account_family', canonical: 'family', zohoModule: 'account_family' },
    ],

    // Non-standard lookup: Zoho Users indexed by "alias", not by Codigo_ERP
    // (Zoho does not allow custom Codigo_ERP fields on the Users endpoint)
    specialLookups: {
        Owner: { endpoint: 'users', canonical: 'agent' },
    },


       destinationMap: {
        Account_Name: { canonical: 'name' },
        Codigo_ERP: { canonical: 'code' },
        email_1: { canonical: 'email' },
        tax_id: { canonical: 'taxId' },
        Phone: { canonical: 'phone' },
        Billing_Street: { canonical: 'street' },
        Billing_City: { canonical: 'city' },
        Billing_State: { canonical: 'state' },
        Billing_Code: { canonical: 'zipCode' },
        Billing_Country: { canonical: 'country' },
        price_list: { canonical: 'priceList', lookup: true },
        payment_terms: { canonical: 'paymentTerms', lookup: true },
        credit_limit: { canonical: 'creditLimit' },
        default_warehouse: { canonical: 'defaultWarehouse', lookup: true },
        account_category: { canonical: 'category', lookup: true },
        account_group: { canonical: 'group', lookup: true },
        account_family: { canonical: 'family', lookup: true },
        tax_regime: { canonical: 'taxRegime' },
        discount_percentage: { canonical: 'discount' },
        Owner: { canonical: 'agent', lookup: true },        // resolved via specialLookups
        ERP_Agent: { canonical: 'agent' },                  // raw value, no lookup
    }
};



