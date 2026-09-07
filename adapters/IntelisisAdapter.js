const { getConnection } = require('../models/db');

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
            throw new Error('Not able to connect pool with database');
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