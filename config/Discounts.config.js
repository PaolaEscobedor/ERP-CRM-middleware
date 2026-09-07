/**
 * Sync Configuration: Sales Discounts 
 * ------------------------------------------------------
 * Source (Intelisis):  Table `Descuento`
 * Destination (Zoho):  Module `discounts`
 * Direction:            Intelisis -> Zoho (one-way)
 * Suggested frequency:  Daily (master catalog, low change rate)
 */

module.exports = {
    // Extraction query.
    sourceQuery:  `SELECT 
                Descuento
            FROM Descuento
        `,

    // Intelisis -> Canonical Model mapping (neutral field names,
    // independent of Zoho's schema)
     sourceMap: {
        code: { source: 'Descuento' },
        rate: { source: 'Descuento' }
    },

    zohoModule: 'discounts',     // destination module in Zoho CRM
    duplicateCheckFields: ['Codigo_ERP'],  // field Zoho uses to detect duplicates on upsert

    lookups: [], // this catalog does not depend on other Zoho modules



    // Canonical Model -> Zoho CRM mapping (API Names)

    destinationMap: {
        Name: { canonical: 'code' },             // Zoho requires "Name" as the display field
        Codigo_ERP: { canonical: 'code' }     // key used for duplicate_check_fields
       
    }
};