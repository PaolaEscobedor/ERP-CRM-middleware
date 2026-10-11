const axios = require('axios');
require('dotenv').config();

/**
 * One-off helper to exchange a Zoho grant code for a refresh token.
 * Usage: node getTokens.js <grant_code>
 *
 * The grant code is generated in the Zoho API Console (Self Client) and is
 * single-use and short-lived. Credentials are read from .env, never hardcoded.
 */

const {
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_REDIRECT_URI = 'http://localhost:3000/callback',
    ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'
} = process.env;

// 2. Grant Code
const grantCode = (process.argv[2] || process.env.ZOHO_GRANT_CODE || '').trim();

async function initializeOAuth() {
     if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !grantCode) {
        console.error('Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET or grant code.');
        console.error('Usage: node getTokens.js <grant_code>');
        process.exit(1);
    }   
     try {
        console.log('Requesting tokens from Zoho...');

        // Zoho expects x-www-form-urlencoded
        const payload = new URLSearchParams();
        payload.append('grant_type', 'authorization_code');
        payload.append('client_id', ZOHO_CLIENT_ID.trim());
        payload.append('client_secret', ZOHO_CLIENT_SECRET.trim());
        payload.append('redirect_uri', ZOHO_REDIRECT_URI);
        payload.append('code', grantCode);

        const { data } = await axios.post(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, payload);

        if (data.refresh_token) {
            console.log('Refresh token obtained. Copy it into .env as ZOHO_REFRESH_TOKEN:');
            console.log(data.refresh_token);
        } else {
            // Do not print the full response: it contains the access token
            console.log('No refresh_token received. Zoho replied with:', data.error || 'unknown response');
        }
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

initializeOAuth();