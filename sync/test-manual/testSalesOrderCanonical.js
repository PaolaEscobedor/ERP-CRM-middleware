const ZohoAdapter = require('../../adapters/ZohoAdapter');
const IntelisisAdapter = require('../../adapters/IntelisisAdapter');
const config = require('../../config/SalesOrders.config.js');

const TEST_RECORD_ID = '7463151000001052008';

async function testSingleOrderSync() {
    const zohoAdapter = new ZohoAdapter();
    const intelisisAdapter = new IntelisisAdapter();


    try {
        const zohoRecord = await zohoAdapter.getRecord(config.zohoModule, TEST_RECORD_ID);
        if (!zohoRecord) throw new Error('Sales Order not found in Zoho.');

        console.log('\n--- Raw Zoho Record ---');
        console.log(JSON.stringify(zohoRecord, null, 2));

        const canonicalRecord = await zohoAdapter.buildCanonicalFromZohoRecord(zohoRecord, config);

        console.log('\n--- CDM Generated ---');
        console.log(JSON.stringify(canonicalRecord, null, 2));

        // validate customer
        if(!canonicalRecord || !canonicalRecord.customer){
            throw new Error('Validation Failed: customer is missing');
        }

        console.log('Sending record to Intelisis ERP');
        const result= await intelisisAdapter.pushCanonical(canonicalRecord, config);

        console.log('\n--- ERP Insertion Result ---');
        console.log(JSON.stringify(result, null, 2));

        console.log(result.syncedCount > 0 ? `\nSuccess: Sales order processed. Intelisis ID: ${result.spResult?.ID}`
            : `\nFail: ${result.spResult?.OkRef || result.error}`);



    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    } finally {
        await intelisisAdapter.close();
    }
}
  
testSingleOrderSync();