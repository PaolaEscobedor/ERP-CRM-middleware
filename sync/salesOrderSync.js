const ZohoAdapter = require('../adapters/ZohoAdapter');
const IntelisisAdapter = require('../adapters/IntelisisAdapter');
const config = require('../config/SalesOrders.config.js');

/**
 * Syncs one Zoho Sales Order into Intelisis (Flow B).
 * Shared by the REST endpoint and the manual test script.
 */

async function syncSalesOrder(recordId){
    const zohoAdapter= new ZohoAdapter();
    const intelisisAdapter = new IntelisisAdapter();

    try{
        const zohoRecord= await zohoAdapter.getRecord(config.zohoModule, recordId);
        if(!zohoRecord) return  {status: 'NOT_FOUND'};

        const canonical= await zohoAdapter.buildCanonicalFromZohoRecord(zohoRecord, config);
        const result= await intelisisAdapter.pushCanonical(canonical, config);

        return{status: result.syncedCount > 0 ? 'OK' : 'FAILED', result};
    }finally{
        await intelisisAdapter.close();
    }


}

module.exports= {syncSalesOrder};