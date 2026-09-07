/**
 * Sync Configuration: Payment Forms
 * ------------------------------------------------------
 * Source (Intelisis):  Table `FormaPago`
 * Destination (Zoho):  Module `sales_payment_form`
 * Direction:            Intelisis <-> Zoho (two-way)
 * Suggested frequency:  Daily (master catalog, low change rate) and on-demand when a sales quote is sent to ERP
 */

module.exports = {
    // Extraction query.
    sourceQuery: `SELECT 
                FormaPago 
            FROM FormaPago`,

    // Intelisis -> Canonical Model mapping (neutral field names,
    // independent of Zoho's schema)
     sourceMap: {
        code: { source: 'FormaPago' }
    },

    zohoModule: 'sales_payment_form',     // destination module in Zoho CRM
    duplicateCheckFields: ['Codigo_ERP'],  // field Zoho uses to detect duplicates on upsert

    lookups: [], // this catalog does not depend on other Zoho modules



    // Canonical Model -> Zoho CRM mapping (API Names)

    destinationMap: {
        Name: { canonical: 'code' },             // Zoho requires "Name" as the display field
        Codigo_ERP: { canonical: 'code' }       // key used for duplicate_check_fields

    }
};