const axios = require('axios');
const { getAccessToken } = require('./services/zohoAuth');
require('dotenv').config();

async function testZohoCall() {
    try {
        console.log('1. Asking fresh Access Token...');
        const accessToken= await getAccessToken();
        console.log('2. Executing GER request to Zoho CRM API...');
        const zohoAPIUrl= process.env.ZOHO_API_URL || 'https://www.zohoapis.com/crm/v8';

        // API V8 Request passing the OAuth token in the Authorization Header
        const response = await axios.get(`${zohoAPIUrl}/settings/modules`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        console.log('\n================ ZOHO CRM CONNECTION SUCCESSFUL! ================\n');
        console.log(`📊 Total modules detected in account: ${response.data.modules.length}`); 
        
        // Formats a sample preview of the first 5 modules
        const sampleModules = response.data.modules.slice(0, 5).map(m => ({
            'Module Name': m.module_name,
            'API Name': m.api_name
        }));

        console.table(sampleModules);
        console.log('=================================================================\n');

    } catch (error) {
        console.error('❌ Error executing Zoho CRM API call:', error.response ? error.response.data : error.message);
    }
}

testZohoCall();