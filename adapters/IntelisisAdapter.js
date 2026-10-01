const { getConnection } = require('../models/db');
const mssql = require('mssql');

/**
 * Source Adapter: Intelisis ERP (SQL Server)
 * ------------------------------------------------------
 * Responsible for extracting raw rows from Intelisis and
 * transforming them into the Canonical Data Model (CDM).
 * This adapter has NO knowledge of Zoho or any destination
 * system — it only understands SQL Server and the config's
 * sourceMap.
 */


class IntelisisAdapter {
     /**
     * Runs config.sourceQuery and maps each row to a canonical
     * object using config.sourceMap.
     * @param {object} config - a sync config (see /config/*.config.js)
     * @returns {Promise<object[]>} array of canonical records
     */

     async fetchCanonical(config) {
        const pool = await getConnection();
        if (!pool) { 
            throw new Error('IntelisisAdapter: unable to connect to ERP database');
        }

        const result = await pool.request().query(config.sourceQuery);

        return result.recordset.map(row => {
            const canonical = {};
            for (const [canonicalField, mapping] of Object.entries(config.sourceMap)) {
                canonical[canonicalField] = mapping.transform ? mapping.transform(mapping.source ? row[mapping.source] : row) : row[mapping.source];
            }
            return canonical;
        });
    }

    /**
     * Loads a set of SP parameters into an mssql request, coercing values
     * to the declared SQL type (reverse-lookup values arrive as strings).
     */

    _bindParameters(request, source, spParameters){
        for (const [spParamName, mapping] of Object.entries(spParameters)){
            let value= source[mapping.canonical];

            if (value !== null && value !== undefined) {
                if(mapping.type === mssql.Int) {
                     value = parseInt(value, 10);
                } else if (mapping.type === mssql.Float) {
                    value = parseFloat(value);
                }
            }
         request.input(spParamName, mapping.type, value);
        }
    }

    /**
    Pushes a canonical Sales Order into Intelisis in two phases:
    * 1) header via config.headerProcedure (returns the new Venta ID)
    * 2) one call per line item via config.detailProcedure (VentaD)
    * Mirrors ZohoAdapter.pushCanonical() to keep both destination
    * adapters interchangeable under the same orchestration contract.
    *
    * @param {object} canonicalRecord - CDM object built by
    *   ZohoAdapter.buildCanonicalFromZohoRecord()
    * @param {object} config - a sync config (see SalesOrders.config.js)
    */

    async pushCanonical(canonicalRecord, config){
        this.pool= await getConnection();
        if(!this.pool){
            throw new Error('IntelisisAdapter: unable to connect to ERP database');
        }

        try{
            // --- Phase 1: header (Venta) ---
            const headerRequest= this.pool.request();
            this._bindParameters(headerRequest, canonicalRecord, config.headerSpParameters); 


            console.log(`Executing stored procedure: ${config.headerProcedure}`);
            const headerResult = await headerRequest.execute(config.headerProcedure);

            // pNetActualizarPedido returns a single row: ID, Ok, OkRef
            const headerRow= headerResult.recordset?.[0];
            const headerOk =headerRow?.Ok == null || headerRow?.Ok === 0;


            if (!headerOk || !headerRow?.ID) {
            return { syncedCount: 0, errorCount: 1, expectedCount: 1, spResult: headerRow };
            }

            const orderId = headerRow.ID;
            console.log(`Header created. Intelisis ID: ${orderId}`);


            // Phase 2: line items (VentaD)

            const lineResults= [];
            for (const line of canonicalRecord.lineItems || []) {
                const lineRequest= this.pool.request(); // a request cannot be reused after execute()
                lineRequest.input('ID', mssql.Int, orderId)  // links the line to the header just created
                this._bindParameters(lineRequest, line, config.detailSpParameters);

                const lineResult= await lineRequest.execute(config.detailProcedure);

                // pNetActualizarPedidoD returns a single row: Ok, OkRef
                const lineRow = lineResult.recordset?.[0];
                lineResults.push({itemCode: line.itemCode, ...lineRow});

                const lineOk= lineRow?.Ok == null || lineRow?.Ok === 0;
                console.log(`  Line ${line.itemCode}: ${lineOk ? 'OK' : `ERROR ${lineRow?.Ok} - ${lineRow?.OkRef}`}`);
            }

            const failedLines = lineResults.filter(r => !(r.Ok == null || r.Ok === 0));


            return{
                syncedCount: failedLines.length === 0 ? 1 : 0,
                errorCount:failedLines.length === 0 ? 0 : 1,
                expectedCount: 1,
                spResult: headerRow,
                lineResults, 
            };

        } catch (error) {
            console.error(`IntelisisAdapter.pushCanonical failed for ${config.headerProcedure}:`, error.message);
            return{
                syncedCount: 0,
                errorCount: 1,
                expectedCount: 1,
                error: error.message,

            };
        }
    }




   /**
     * Closes the SQL Server connection pool, if one was opened.
     * Should be called by the orchestrator once the sync finishes
     * (success or failure) when each module runs as an independent process.
     */

   async close() {
        if (this.pool) {
        await this.pool.close();
        console.log('IntelisisAdapter: DB connection closed');
            this.pool = null;
        }
    }
} 

module.exports = IntelisisAdapter;