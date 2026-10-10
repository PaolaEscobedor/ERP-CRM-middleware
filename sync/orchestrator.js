const IntelisisAdapter = require('../adapters/IntelisisAdapter');
const ZohoAdapter = require('../adapters/ZohoAdapter');

/**
 * Generic sync orchestrator.
 * ------------------------------------------------------
 * Coordinates the extraction (IntelisisAdapter) and the
 * loading (ZohoAdapter) steps for a given sync config.
 * Contains no source- or destination-specific logic — it
 * only knows the Canonical Data Model contract.
 *
 * @param {object} config - a sync config (see /config/*.config.js)
 * @param {string} label - human-readable name for logging
 */


async function runSync(config, label= config.zohoModule) {
    console.log(`\n=== Starting sync: ${label} ===`);

    // to test sync speed
    const startedAt = Date.now();
    const intelisisAdapter = new IntelisisAdapter();
    const zohoAdapter = new ZohoAdapter();

    try {
        console.log('Extracting form ERP and mapping to Canonical Model');
        const canonicalRecords = await intelisisAdapter.fetchCanonical(config);
        console.log(`Extracted ${canonicalRecords.length} records from ERP`);

        if (canonicalRecords.length === 0) {
            console.log('No records to sync, exiting');
            return {skipped: true}
        }

        console.log('Loading records into Zoho CRM');

        const result = await zohoAdapter.pushCanonical(canonicalRecords, config);
       console.log(`Sync completed: ${result.syncedCount}/${result.expectedCount} records synced, ${result.errorCount} errors in ${config.zohoModule} (${Date.now() - startedAt} ms)`);
        
        return result;

    } catch (error) {
        console.error(`Sync failed for ${label}:`, error);
        throw error;
    } finally {
        // Each module runs as an independent process for now,
        // so the pool must be closed here to avoid dangling connections.
        await intelisisAdapter.close();
    }
}


module.exports = { runSync };



