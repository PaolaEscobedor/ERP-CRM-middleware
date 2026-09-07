/**
 * Sync Configuration: Sales Representatives
 * ------------------------------------------------------
 * Source (Intelisis):  Table `Agente`
 * Destination (Zoho):  Module `sales_representative`
 * Direction:            Intelisis -> Zoho (one-way)
 * Suggested frequency:  Daily (master catalog, low change rate)
 */

module.exports = {
    // Extraction query.
    sourceQuery: `SELECT 
                Agente, 
                Nombre,
                Estatus,
                SucursalEmpresa 
            FROM Agente
        `,

    // Intelisis -> Canonical Model mapping (neutral field names,
    // independent of Zoho's schema)
    sourceMap: {
        code: { source: 'Agente' },
        name: { source: 'Nombre' },
        status: { source: 'Estatus' },
        branch: { source: 'SucursalEmpresa' },
    },

    zohoModule: 'sales_representative',    // destination module in Zoho CRM
    duplicateCheckFields: ['Codigo_ERP'],  // field Zoho uses to detect duplicates on upsert

    lookups: [
        {
            field: 'Sucursal', canonical: 'branch', zohoModule: 'Branches'
        }

    ], // Lookup for company Branches asigned to each sales representative

    // Canonical Model -> Zoho CRM mapping (API Names)
    destinationMap: {
        Name: { canonical: 'name' },
        Codigo_ERP: { canonical: 'code' },     // key used for duplicate_check_fields
        Estatus: { canonical: 'status' },
        Sucursal: { canonical: 'branch', lookup: true }, // Lookup field for Branches
    }
};