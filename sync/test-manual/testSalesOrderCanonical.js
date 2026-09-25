const ZohoAdapter = require('../../adapters/ZohoAdapter');
const IntelisisDestinationAdapter = require('../../adapters/IntelisisAdapter');
const config = require('../../config/SalesOrders.config.js');

const TEST_RECORD_ID = '7463151000000901025';

async function testCDMOnly() {
    const zohoAdapter = new ZohoAdapter();

    try {
        const zohoRecord = await zohoAdapter.getRecord(config.zohoModule, TEST_RECORD_ID);
        if (!zohoRecord) throw new Error('Sales Order not found in Zoho.');

        console.log('\n--- Raw Zoho Record ---');
        console.log(JSON.stringify(zohoRecord, null, 2));

        const canonicalRecord = await zohoAdapter.buildCanonicalFromZohoRecord(zohoRecord, config);

        console.log('\n--- CDM Generated ---');
        console.log(JSON.stringify(canonicalRecord, null, 2));

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}
  
testCDMOnly();