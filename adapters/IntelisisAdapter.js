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

    async _findExistingOrder( transaction, canonnicalRecord, config){
        const {table, column, canonical}= config.idempotency;
        const externalId= canonnicalRecord[canonical];
        if(!externalId) return null;

        const request= new mssql.Request(transaction);
        request.input('externalId', mssql.VarChar(50), String(externalId));

        // table/column come from config

        const result= await request.query(`
        SELECT TOP 1 ID, Estatus
        FROM ${table} WHERE ${column} = @externalId AND Estatus <> 'CANCELADO'
        ORDER BY ID DESC`
        );

        return result.recordset?.[0] || null;

    }

    
/**
 * Looks up an order previously imported from the CRM, using the
 * external record ID stored in the column declared in config.idempotency.
 * Runs inside the caller's transaction and locks the row so two
 * simultaneous syncs of the same record cannot both insert it.
 */



/**
* Loads a set of SP parameters into an mssql request, coercing values
* to the declared SQL type (reverse-lookup values arrive as strings).
*/

_bindParameters(request, source, spParameters){
    for (const [spParamName, mapping] of Object.entries(spParameters)){
        let value= source[mapping.canonical];

        // Send explicit NULL instead of "not supplied" so the SP's own
        // validations (Ok/OkRef) report missing fields clearly.
        if (value === undefined) value = null;

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
 Pushes a canonical Sales Order into Intelisis:
 * Before pushing, checks whether the CRM record was already imported (idempotency)
 * 1) header via config.headerProcedure (insert, or update if it already exists)
 * 2) one call per line item via config.detailProcedure (VentaD)
* Everything runs in a single transaction: if the header or any line
* fails, nothing is saved.
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

        
        const transaction =  new mssql.Transaction(this.pool);

        try{
            await transaction.begin();
            // idempotency check

            const existing= await this._findExistingOrder(transaction, canonicalRecord, config);

            if (existing && !config.idempotency.editableStatuses.includes(String(existing.Estatus).trim())) {
                await transaction.rollback();
                return {
                    syncedCount: 0, errorCount: 1, expectedCount: 1,
                    error: `Order already exists in Intelisis (ID ${existing.ID}) with status ${existing.Estatus} and can no longer be modified.`,
                };
            }
            // --- Phase 1: header (Venta) ---
            const headerRequest= new mssql.Request(transaction);
            if (existing) {
                //  passing @ID makes the SP update the header and clear its previous lines
                headerRequest.input('ID', mssql.Int, existing.ID);
            }

            this._bindParameters(headerRequest, canonicalRecord, config.headerSpParameters); 


            console.log(`${existing ? 'Updating' : 'Creating'} header via ${config.headerProcedure}`);
            const headerResult = await headerRequest.execute(config.headerProcedure);

            // pNetActualizarPedido returns a single row: ID, Ok, OkRef
            const headerRow= headerResult.recordset?.[0];
            const headerOk =headerRow?.Ok == null || headerRow?.Ok === 0;


            if (!headerOk || !headerRow?.ID) {
                await transaction.rollback();
                return { syncedCount: 0, errorCount: 1, expectedCount: 1, spResult: headerRow };
            }

            const orderId = headerRow.ID;
            console.log(`Header created. Intelisis ID: ${orderId}`);


            // Phase 2: line items (VentaD)

            const lineResults= [];
            for (const line of canonicalRecord.lineItems || []) {
                const lineRequest= new mssql.Request(transaction); 
                lineRequest.input('ID', mssql.Int, orderId)  // links the line to the header just created
                this._bindParameters(lineRequest, line, config.detailSpParameters);

                const lineResult= await lineRequest.execute(config.detailProcedure);

                // pNetActualizarPedidoD returns a single row: Ok, OkRef
                const lineRow = lineResult.recordset?.[0];
                lineResults.push({itemCode: line.itemCode, ...lineRow});

                const lineOk= lineRow?.Ok == null || lineRow?.Ok === 0;
                console.log(`  Line ${line.itemCode}: ${lineOk ? 'OK' : `ERROR ${lineRow?.Ok} - ${lineRow?.OkRef}`}`);

                if (!lineOk) {
                    await transaction.rollback(); // one failed line undoes the header and every previous line
                    return  {
                        syncedCount: 0, errorCount: 1, expectedCount: 1,
                        spResult: headerRow, lineResults,
                        error: `Line ${line.itemCode} failed; the whole order was rolled back.`,
                    };
                }
            }

            await transaction.commit(); // saves transaction until here 


            return{
                syncedCount: 1, errorCount: 0, 
                expectedCount: 1,
                errorCount:0,
                action: existing ? 'update': 'insert',
                spResult: headerRow, lineResults,
                
            };

        } catch (error) {
            try { await transaction.rollback(); } catch (_){/* already rolled back */}
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