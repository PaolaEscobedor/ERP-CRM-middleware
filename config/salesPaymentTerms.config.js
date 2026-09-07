/**
 * Sync Configuration: Payment Terms
 * ------------------------------------------------------
 * Source (Intelisis):  Table `Condicion`
 * Destination (Zoho):  Module `sales_payment_terms`
 * Direction:            Intelisis -> Zoho (one-way)
 * Suggested frequency:  Daily (master catalog, low change rate)
 */

module.exports = {
    // Extraction query.
    sourceQuery: `SELECT Condicion, DiasVencimiento FROM Condicion`,

    // Intelisis -> Canonical Model mapping (neutral field names,
    // independent of Zoho's schema)
     sourceMap: {
        code: { source: 'Condicion' },
        dueDays: { source: 'DiasVencimiento' }
    },

    zohoModule: 'sales_payment_terms',     // destination module in Zoho CRM
    duplicateCheckFields: ['Codigo_ERP'],  // field Zoho uses to detect duplicates on upsert

    lookups: [], // this catalog does not depend on other Zoho modules



    // Canonical Model -> Zoho CRM mapping (API Names)

    destinationMap: {
        Name: { canonical: 'code' },             // Zoho requires "Name" as the display field
        Codigo_ERP: { canonical: 'code' },       // key used for duplicate_check_fields
        Dia_Vencimiento: { canonical: 'dueDays' },
    }
};