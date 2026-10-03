const mssql = require('mssql');

/**
 * Sync Configuration: Sales Orders
 * ------------------------------------------------------
 * Source (Zoho):  Module `Sales_Orders`
 * Destination (Intelisis): spNetActualizarPedido and pNetActualizarPedidoD
 * Direction:            Zoho -> Intelisis (one-way)
 * Suggested frequency:  On Demand 
 * 
 *  * IMPORTANT — trigger flow:
 * A Zoho custom button (Deluge) sends ONLY the Sales_Order record ID to
 * this middleware's endpoint. The middleware performs a GET request
 * against Zoho's REST API v8 to fetch the full record using its native
 * Zoho API Names, then translates it into the Canonical Data Model (CDM)
 * before mapping it to Intelisis SP parameters. 
 * 
 */

module.exports = {
    // Zoho CRM module target and query parameters

    zohoModule: 'Sales_Orders',     //  Source  module in Zoho CRM
 
    // Phase 1: Stored Procedure for the Order Header (Venta table)
    headerProcedure: 'pNetActualizarPedido',
    
    // Phase 2: Stored Procedure for the Order Line Items (VentaD table)
    detailProcedure: 'pNetActualizarPedidoD',

    // Mapping Rules from Zoho CRM record (native API Names) to Canonical Data Model (CDM)
    sourceMap:{
        user:  { zohoField: '__unused__', defaultValue: 'DEMO' },
        company: {zohoField: 'Company', defaultValue: 'GRAL' },
        branch: { zohoField: 'operating_branch', 
                transform: (val) => {
                    const raw = val?.name || val || '';
                    const code = raw.split('-')[0].trim();
                    return parseInt(code, 10) || 0;
                }
        },
        status: {zohoField: '__unused__', defaultValue: 'SINAFECTAR' },
        issueDate: { zohoField: 'creation_date' },
        customer: { zohoField: 'Account_Name' },  // lookup -> Accounts
        agent: { zohoField: 'Owner' },             // record owner, not a custom field -> Users (alias)
        reference:{
            transform: (record) => {
            const folio = record.SO_Number || '';
            const extra = record.Reference || '';
            return [folio, extra].filter(Boolean).join(' - ').substring(0, 50);
            }
        },
        notes: {zohoField: 'Comments'},
        warehouse: { zohoField: 'warehouse' }, 
        priceList: { zohoField: 'price_list' },         // lookup -> Price_Books
        paymentTerms: { zohoField: 'payment_terms' },   // lookup -> sales_payment_terms
        paymentMethod: { zohoField: 'payment_form' },   // lookup -> TODO: confirm real module name, manually selected
        accountBranch: { zohoField: 'account_branch' }, // lookup -> account_branches, manually selected
        globalDiscount: { zohoField: 'discount_percentage' }, // lookup -> discounts, auto-filled from Account via Deluge
        currency: { zohoField: 'Moneda', defaultValue: 'Pesos' },
        exchangeRate: { zohoField: 'TipoCambio', transform: (val) => parseFloat(val) || 1.0 },
        shippingMethod: { zohoField: 'FormaEnvio' },
        externalId: { zohoField: 'id' },

        lineItems: {
            zohoField:'Ordered_Items',
            transform: (items) => Array.isArray(items) ? items.map(item => {
                    const lineTotal = parseFloat(item.Total) || 0;
                    const lineDiscountAmount = parseFloat(item.Discount) || 0;
                    return {
                        itemCode: item.Product_Name?.Product_Code ||  'DEFAULT',
                        quantity: parseFloat( item.Quantity) || 0.0, 
                        price: parseFloat(item.List_Price ) || 0.0,
                        unit: item.Unidad || 'pza',
                        discount: lineTotal > 0 ? (lineDiscountAmount / lineTotal) * 100 : 0,
                        tax1: parseFloat(item.Tax) || 16.0,
                        tax2: null,
                        tax3: null
                    };  
            }) : []

        },

        totalItems: {
        zohoField: 'Ordered_Items',
        transform: (items) => Array.isArray(items) ? items.length : 0
        }
    },

   // to identify in Database
    idempotency: {
    table: 'Venta',
    column: 'FolioCRM',
    canonical: 'externalId',
    editableStatuses: ['SINAFECTAR', 'CONFIRMAR'],
    },


    // Phase 3: Reverse lookups: Zoho record ID -> Intelisis code / numeric value
    reverseLookups: [
        { field: 'customer', zohoModule: 'Accounts', keyField: 'Codigo_ERP' },
        { field: 'priceList', zohoModule: 'Price_Books', keyField: 'Codigo_ERP' },
        { field: 'paymentTerms', zohoModule: 'sales_payment_terms', keyField: 'Codigo_ERP' },
        { field: 'paymentMethod', zohoModule: 'sales_payment_form', keyField: 'Codigo_ERP' }, 
        { field: 'accountBranch', zohoModule: 'account_branches', keyField: 'Branch_ID' },  
        { field: 'globalDiscount', zohoModule: 'discounts', keyField: 'Percentage' },       
    ],


    // Non-standard lookup: Zoho Users indexed by "alias", resolved from record Owner
    specialReverseLookups: {
        agent: { endpoint: 'users' },
    },


    // Destination Mapping: CDM (English) -> Intelisis SP parameters
    headerSpParameters: {
        Usuario: { canonical: 'user', type: mssql.VarChar(10) },
        Empresa: { canonical: 'company', type: mssql.VarChar(5) },
        Sucursal: { canonical: 'branch', type: mssql.Int },
        Estatus: { canonical: 'status', type: mssql.VarChar(15) },
        FechaEmision: { canonical: 'issueDate', type: mssql.DateTime },
        Cliente: { canonical: 'customer', type: mssql.VarChar(10) },
        Agente: { canonical: 'agent', type: mssql.VarChar(10) },
        Referencia: { canonical: 'reference', type: mssql.VarChar(50) },
        FolioCRM: { canonical: 'externalId', type: mssql.VarChar(50) },
        Observaciones: { canonical: 'notes', type: mssql.VarChar(100) },
        Almacen: { canonical: 'warehouse', type: mssql.VarChar(10) },
        ListaPrecios: { canonical: 'priceList', type: mssql.VarChar(20) },
        DescuentoGlobal: { canonical: 'globalDiscount', type: mssql.Float },
        Moneda: { canonical: 'currency', type: mssql.VarChar(10) },
        TipoCambio: { canonical: 'exchangeRate', type: mssql.Float },
        Condicion: { canonical: 'paymentTerms', type: mssql.VarChar(50) },
        FormaPagoTipo: { canonical: 'paymentMethod', type: mssql.VarChar(50) },
        FormaEnvio: { canonical: 'shippingMethod', type: mssql.VarChar(50) },
        EnviarA: { canonical: 'accountBranch', type: mssql.VarChar(50) },
        TotalDet: { canonical: 'totalItems', type: mssql.Int }
    },

    // Destination Mapping: CDM line item -> pNetActualizarPedidoD parameters
    // @ID is injected at runtime from the header result; @Renglon is omitted

    detailSpParameters: {
        Articulo: {canonical: 'itemCode', type: mssql.VarChar(20)}, 
        Cantidad: { canonical: 'quantity', type: mssql.Float },
        Precio: { canonical: 'price', type: mssql.Float},
        Unidad: { canonical: 'unit', type: mssql.VarChar(50) },
        DescuentoLinea: { canonical: 'discount', type: mssql.Float },
        Impuesto1: { canonical: 'taax1', type: mssql.Float  },
        Impuesto2: { canonical: 'tax2', type: mssql.Float },
        Impuesto3: { canonical: 'tax3', type: mssql.Float },

    }
};






        


