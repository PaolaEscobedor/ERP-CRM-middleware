const axios  = require('axios');
require('dotenv').config();


/**
 *  Get Access Token from Refresh Token at .env
 * @returns {Promise<string>} Token valid through 1 hour
 */

async function getAccessToken(){
    try{
        const accountUrl= process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';

        // DEBUG Verify if node reads de Refresh token
        // const refreshToken = (process.env.ZOHO_REFRESH_TOKEN || '').trim();
        // console.log('Refresh Token loades from .env:', refreshToken ? `${refreshToken.substring(0, 15)}...` : 'EMPTY / UNDEFINED');

        const payload = new URLSearchParams();
        payload.append('grant_type', 'refresh_token');
        payload.append('client_id', (process.env.ZOHO_CLIENT_ID || '').trim());
        payload.append('client_secret', (process.env.ZOHO_CLIENT_SECRET || '').trim());
        payload.append('refresh_token', (process.env.ZOHO_REFRESH_TOKEN || '').trim());

        const response = await axios.post(`${accountUrl}/oauth/v2/token`, payload);

        if(response.data && response.data.access_token){
            return {
                accessToken: response.data.access_token,
                apiDomain: response.data.api_domain || 'https://www.zohoapis.com'
            };
        } else {
            console.error('Zoho answer:', response.data)
            throw new Error('No access_token recieved in Zohos response');
        }
    } catch (error){
        console.error('Error obtaining Access Token from Zoho: ', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { getAccessToken };